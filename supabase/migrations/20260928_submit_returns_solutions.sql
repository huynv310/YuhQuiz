-- Sửa submit_and_grade_exam: trả kèm lời giải (solutions) ngay sau khi nộp bài lần đầu,
-- đồng bộ với get_answer_keys_after_submit (20260923) để "Lời giải chi tiết" hiện ngay,
-- không cần thoát ra rồi vào lại bằng chế độ Xem lại mới thấy.

CREATE OR REPLACE FUNCTION public.submit_and_grade_exam(
  p_exam_id uuid,
  p_session_token uuid,
  p_student_name text,
  p_class_name text,
  p_answers jsonb,
  p_cheat_count int,
  p_total_away_seconds int,
  p_student_id uuid DEFAULT NULL,   -- BỊ BỎ QUA: luôn dùng auth.uid()
  p_class_id uuid DEFAULT NULL,
  p_school text DEFAULT NULL,
  p_telemetry jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exam RECORD;
  v_kr RECORD;
  v_prev RECORD;
  v_keys JSONB;
  v_config JSONB;
  v_grade JSONB;
  v_total_score NUMERIC(5,2) := 0.0;
  v_score_details JSONB := '{"part_1":{},"part_2":{},"part_3":{}}'::jsonb;
  v_q_idx INT;
  v_p1_key TEXT; v_p1_ans TEXT;
  v_sub TEXT;
  v_sub_items TEXT[] := ARRAY['a','b','c','d'];
  v_correct_sub_count INT;
  v_p2_score NUMERIC(5,3);
  v_p2_sub_details JSONB;
  v_ans_sub TEXT; v_key_sub TEXT;
  v_clean_key TEXT; v_clean_ans TEXT;
  v_p1_count INT; v_p2_count INT; v_p3_count INT;
  v_p1_total NUMERIC(5,2); v_p2_total NUMERIC(5,2); v_p3_total NUMERIC(5,2);
  v_p1_unit NUMERIC(5,3); v_p2_base NUMERIC(5,3); v_p3_unit NUMERIC(5,3);
  v_ratio NUMERIC(5,2);
  v_attempt INT;
  v_class UUID;
  v_telemetry JSONB := COALESCE(p_telemetry, '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập để nộp bài'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.'; END IF;
  IF v_exam.start_at IS NOT NULL AND now() < v_exam.start_at THEN RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở'; END IF;
  -- Dung sai 2 phút (jitter 30s + trễ mạng)
  IF v_exam.end_at IS NOT NULL AND now() > (v_exam.end_at + INTERVAL '2 minutes') THEN
    RAISE EXCEPTION 'Kỳ thi đã kết thúc';
  END IF;

  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys, 'solutions', COALESCE(v_kr.solutions, '{}'::jsonb));

  -- Phiên hiện có: đúng chủ, chưa nộp, chưa quá giờ
  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF FOUND THEN
    IF v_prev.student_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
    IF v_prev.status = 'submitted' THEN   -- idempotent: trả kết quả đã chấm
      RETURN jsonb_build_object('status','success','score', v_prev.total_score,
                                'score_details', v_prev.score_details, 'answer_keys', v_keys);
    END IF;
    IF v_exam.duration_minutes > 0
       AND now() > v_prev.started_at + make_interval(mins => v_exam.duration_minutes) + INTERVAL '3 minutes' THEN
      RAISE EXCEPTION 'Đã quá thời gian làm bài';
    END IF;
  END IF;

  -- Số lần làm bài
  SELECT count(*) INTO v_attempt FROM submissions
   WHERE exam_id = p_exam_id AND student_id = v_uid AND status = 'submitted' AND session_token <> p_session_token;
  IF NOT v_exam.allow_multiple_attempts AND v_attempt > 0 THEN
    RAISE EXCEPTION 'Đề này chỉ cho phép làm 1 lần';
  END IF;
  v_attempt := v_attempt + 1;

  v_class := CASE WHEN p_class_id IS NOT NULL AND public.is_class_member(p_class_id) THEN p_class_id END;

  IF jsonb_typeof(v_telemetry) <> 'array' THEN v_telemetry := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_telemetry) > 500 THEN
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_telemetry
    FROM (SELECT e FROM jsonb_array_elements(v_telemetry) e LIMIT 500) x;
  END IF;

  v_grade := public.grade_answers(v_exam.config, v_keys, p_answers);
  v_total_score := (v_grade->>'score')::numeric;
  v_score_details := v_grade->'details';

  INSERT INTO submissions (
    exam_id, session_token, student_name, class_name, answers, student_answers, score, total_score,
    score_details, cheat_count, total_away_seconds, telemetry_logs, attempt_number, status, submitted_at,
    student_id, class_id, school
  ) VALUES (
    p_exam_id, p_session_token, COALESCE(NULLIF(p_student_name,''), 'Học sinh'), p_class_name,
    p_answers, p_answers, ROUND(v_total_score, 2), ROUND(v_total_score, 2),
    v_score_details, GREATEST(COALESCE(p_cheat_count,0),0), GREATEST(COALESCE(p_total_away_seconds,0),0),
    v_telemetry, v_attempt, 'submitted', now(), v_uid, v_class, p_school
  )
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
    answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
    score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
    cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
    telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
    status = 'submitted', submitted_at = now(),
    class_id = COALESCE(EXCLUDED.class_id, submissions.class_id),
    school = COALESCE(EXCLUDED.school, submissions.school);

  RETURN jsonb_build_object('status','success','score', ROUND(v_total_score, 2),
                            'score_details', v_score_details, 'answer_keys', v_keys);
END $$;
