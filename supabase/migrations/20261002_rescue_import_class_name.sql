-- teacher_import_rescue() không truyền class_name khi INSERT vào submissions,
-- cột này NOT NULL trên DB thật (constraint được thêm tay trước đó, không có
-- trong migration nào) → lỗi "null value in column class_name violates
-- not-null constraint" mỗi khi giáo viên nhập file cứu hộ.
-- Thêm tham số p_class_name (giáo viên gửi từ className trong file .yuhquiz);
-- nếu thiếu, tự tra theo lớp mà giáo viên đang dạy học sinh đó.

DROP FUNCTION IF EXISTS public.teacher_import_rescue(uuid, uuid, uuid, jsonb, int, int);

CREATE OR REPLACE FUNCTION public.teacher_import_rescue(
  p_exam_id uuid, p_student_id uuid, p_session_token uuid, p_answers jsonb,
  p_cheat_count int DEFAULT 0, p_total_away_seconds int DEFAULT 0, p_class_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD; v_kr RECORD; v_keys jsonb; v_grade jsonb; v_prev RECORD;
  v_name text; v_attempt int; v_class_name text;
BEGIN
  IF NOT public.owns_exam(p_exam_id) THEN RAISE EXCEPTION 'Bạn không sở hữu đề này'; END IF;
  IF NOT public.teaches_student(p_student_id) THEN RAISE EXCEPTION 'Học sinh không thuộc lớp của bạn'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys);
  v_grade := public.grade_answers(v_exam.config, v_keys, p_answers);

  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF FOUND AND v_prev.student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'File cứu hộ này thuộc học sinh khác';
  END IF;
  IF FOUND AND v_prev.status = 'submitted' THEN
    RAISE EXCEPTION 'Bài này đã được nộp/nhập trước đó';
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = p_student_id;

  v_class_name := NULLIF(p_class_name, '');
  IF v_class_name IS NULL THEN
    SELECT c.name INTO v_class_name FROM class_memberships m JOIN classrooms c ON c.id = m.class_id
     WHERE m.student_id = p_student_id LIMIT 1;
  END IF;
  v_class_name := COALESCE(v_class_name, 'Chưa rõ lớp');

  SELECT count(*) + 1 INTO v_attempt FROM submissions
   WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'submitted';

  INSERT INTO submissions (exam_id, session_token, student_id, student_name, class_name, answers, student_answers,
      score, total_score, score_details, cheat_count, total_away_seconds, telemetry_logs,
      attempt_number, status, submitted_at)
  VALUES (p_exam_id, p_session_token, p_student_id, COALESCE(NULLIF(v_name,''),'Học sinh'), v_class_name, p_answers, p_answers,
      (v_grade->>'score')::numeric, (v_grade->>'score')::numeric, v_grade->'details',
      GREATEST(COALESCE(p_cheat_count,0),0), GREATEST(COALESCE(p_total_away_seconds,0),0),
      '[{"type":"imported_from_rescue_file"}]'::jsonb, v_attempt, 'submitted', now())
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
      student_name = EXCLUDED.student_name, class_name = EXCLUDED.class_name,
      answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
      score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
      cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
      telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
      status = 'submitted', submitted_at = now();

  RETURN jsonb_build_object('status','success','score',(v_grade->>'score')::numeric,'student_name',v_name);
END $$;
REVOKE ALL ON FUNCTION public.teacher_import_rescue(uuid,uuid,uuid,jsonb,int,int,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_import_rescue(uuid,uuid,uuid,jsonb,int,int,text) TO authenticated;
