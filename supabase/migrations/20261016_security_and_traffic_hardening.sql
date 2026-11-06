-- ====================================================================
-- YUHQUIZ MIGRATION: 20261016_security_and_traffic_hardening.sql
-- 1. Khóa truy cập Đề thi riêng tư (is_private) & Khung giờ theo lớp (exam_assignments)
--    trên cả View public_exams, public_leaderboard, start_attempt, save_draft, submit_and_grade_exam.
-- 2. Cô lập Kho câu hỏi (question_bank) theo Phương án A (author_id = auth.uid()).
-- 3. Ẩn cheat_count & total_away_seconds của học sinh khác trên public_leaderboard.
-- 4. Triệt tiêu Row-Level Lock Contention trên teacher_stats khi cả phòng thi nộp bài đồng loạt.
-- 5. Đồng bộ chuẩn hóa chấm điểm Phần III (sai số 1e-6) và ghi đầy đủ score_part_1/2/3.
-- ====================================================================

-- 1. HÀM KIỂM TRA QUYỀN TIẾP CẬN ĐỀ THI & KHUNG GIỜ THEO LỚP ----------------
CREATE OR REPLACE FUNCTION public.can_access_exam(p_exam_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.id = p_exam_id
      AND (
        public.owns_exam(e.id)
        OR (
          e.is_active = true
          AND (
            NOT COALESCE(e.is_private, false)
            OR EXISTS (
              SELECT 1
              FROM public.exam_assignments ea
              JOIN public.class_memberships cm ON cm.class_id = ea.class_id
              WHERE ea.exam_id = e.id
                AND cm.student_id = auth.uid()
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_exam(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_exam(uuid) TO authenticated;

-- Kiểm tra khung giờ mở/đóng đề thi (tính cả khung giờ riêng của lớp được giao nếu có)
CREATE OR REPLACE FUNCTION public.check_exam_schedule(
  p_exam_id uuid,
  p_grace interval DEFAULT interval '0 seconds'
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD;
  v_has_assignments boolean;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.';
  END IF;

  -- Chủ sở hữu đề thi (Giáo viên tạo đề) được phép xem/chạy thử
  IF public.owns_exam(p_exam_id) THEN
    RETURN;
  END IF;

  -- Kiểm tra khung giờ toàn cục của đề thi
  IF v_exam.start_at IS NOT NULL AND v_now < v_exam.start_at THEN
    RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở';
  END IF;
  IF v_exam.end_at IS NOT NULL AND v_now > (v_exam.end_at + p_grace) THEN
    RAISE EXCEPTION 'Kỳ thi đã kết thúc';
  END IF;

  -- Kiểm tra quyền truy cập đề riêng tư (is_private) và khung giờ lớp học (exam_assignments)
  SELECT EXISTS (
    SELECT 1 FROM public.exam_assignments WHERE exam_id = p_exam_id
  ) INTO v_has_assignments;

  IF COALESCE(v_exam.is_private, false) OR v_has_assignments THEN
    -- Nếu là đề riêng tư, bắt buộc học sinh phải thuộc ít nhất 1 lớp được giao đề và nằm trong khung giờ của lớp đó
    IF COALESCE(v_exam.is_private, false) THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.exam_assignments ea
        JOIN public.class_memberships cm ON cm.class_id = ea.class_id
        WHERE ea.exam_id = p_exam_id
          AND cm.student_id = auth.uid()
          AND (ea.start_at IS NULL OR v_now >= ea.start_at)
          AND (ea.end_at IS NULL OR v_now <= (ea.end_at + p_grace))
      ) THEN
        RAISE EXCEPTION 'Bạn không thuộc lớp được giao đề thi này hoặc ngoài khung giờ làm bài của lớp';
      END IF;
    END IF;
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.check_exam_schedule(uuid, interval) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_exam_schedule(uuid, interval) TO authenticated;

-- 2. CẬP NHẬT VIEW CÔNG KHAI (CHỐNG IDOR ĐỀ RIÊNG TƯ & ẨN CHỈ SỐ GIAN LẬN) --
DROP VIEW IF EXISTS public.public_exams;
CREATE VIEW public.public_exams AS
  SELECT id, short_id, author_id, created_by, title, subject, grade, duration_minutes,
         pdf_r2_url, pdf_url, status, allow_multiple_attempts, grading_config, config,
         teacher_name, start_at, end_at, is_private, is_active, created_at, updated_at
  FROM public.exams e
  WHERE e.is_active = true
    AND public.can_access_exam(e.id);

DROP VIEW IF EXISTS public.public_leaderboard;
CREATE VIEW public.public_leaderboard AS
  SELECT s.id,
         s.exam_id,
         s.student_id,
         s.student_name,
         s.class_name,
         s.school,
         s.score,
         s.total_score,
         -- Chỉ giáo viên sở hữu đề hoặc chính học sinh đó mới thấy số lần rời tab thật;
         -- người khác chỉ nhận 0 để bảo vệ quyền riêng tư học sinh trên BXH công khai.
         CASE
           WHEN s.student_id = auth.uid() OR public.owns_exam(s.exam_id) THEN s.cheat_count
           ELSE 0
         END AS cheat_count,
         CASE
           WHEN s.student_id = auth.uid() OR public.owns_exam(s.exam_id) THEN s.total_away_seconds
           ELSE 0
         END AS total_away_seconds,
         s.status,
         s.started_at,
         s.submitted_at
  FROM public.submissions s
  WHERE s.status = 'submitted'
    AND public.can_access_exam(s.exam_id);

REVOKE ALL ON public.public_exams, public.public_leaderboard FROM anon, public;
GRANT SELECT ON public.public_exams, public.public_leaderboard TO authenticated;

-- 3. CÔ LẬP KHO CÂU HỎI THEO PHƯƠNG ÁN A (CHỐNG LỘ ĐÁP ÁN KHI TỰ ĐĂNG KÝ TEACHER)
DROP POLICY IF EXISTS qbank_select ON public.question_bank;
CREATE POLICY qbank_select ON public.question_bank FOR SELECT TO authenticated
  USING (author_id = auth.uid());

-- 4. ĐỒNG BỘ HÀM CHẤM ĐIỂM grade_answers (CHUẨN HÓA PHẦN III & ĐIỂM TỪNG PHẦN)
CREATE OR REPLACE FUNCTION public.grade_answers(p_config jsonb, p_keys jsonb, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_config JSONB := p_config;
  v_keys JSONB := p_keys;
  v_total_score NUMERIC(5,2) := 0.0;
  v_s1 NUMERIC(5,2) := 0.0;
  v_s2 NUMERIC(5,2) := 0.0;
  v_s3 NUMERIC(5,2) := 0.0;
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
BEGIN
  v_p1_count := COALESCE((v_config->'sections'->0->>'question_count')::int, 0);
  v_p2_count := COALESCE((v_config->'sections'->1->>'question_count')::int, 0);
  v_p3_count := COALESCE((v_config->'sections'->2->>'question_count')::int, 0);
  v_p1_total := COALESCE((v_config->'sections'->0->>'total_score')::numeric, (v_config->>'p1_total_score')::numeric, 3.0);
  v_p2_total := COALESCE((v_config->'sections'->1->>'total_score')::numeric, (v_config->>'p2_total_score')::numeric, 4.0);
  v_p3_total := COALESCE((v_config->'sections'->2->>'total_score')::numeric, (v_config->>'p3_total_score')::numeric, 3.0);
  v_p1_unit := CASE WHEN v_p1_count > 0 THEN (v_p1_total / v_p1_count) ELSE 0 END;
  v_p2_base := CASE WHEN v_p2_count > 0 THEN (v_p2_total / v_p2_count) ELSE 0 END;
  v_p3_unit := CASE WHEN v_p3_count > 0 THEN (v_p3_total / v_p3_count) ELSE 0 END;

  -- PHẦN I
  IF v_p1_count > 0 THEN
    FOR v_q_idx IN 1..v_p1_count LOOP
      v_p1_key := UPPER(TRIM(COALESCE(v_keys->'part_1'->>v_q_idx::text, '')));
      v_p1_ans := UPPER(TRIM(COALESCE(p_answers->'part_1'->>v_q_idx::text, '')));
      IF v_p1_ans <> '' AND v_p1_ans = v_p1_key THEN
        v_s1 := v_s1 + v_p1_unit;
        v_total_score := v_total_score + v_p1_unit;
        v_score_details := jsonb_set(v_score_details, ARRAY['part_1', v_q_idx::text],
          jsonb_build_object('is_correct', true, 'score', ROUND(v_p1_unit, 2), 'student_ans', v_p1_ans, 'key', v_p1_key));
      ELSE
        v_score_details := jsonb_set(v_score_details, ARRAY['part_1', v_q_idx::text],
          jsonb_build_object('is_correct', false, 'score', 0, 'student_ans', v_p1_ans, 'key', v_p1_key));
      END IF;
    END LOOP;
  END IF;

  -- PHẦN II (10% - 25% - 50% - 100%)
  IF v_p2_count > 0 THEN
    FOR v_q_idx IN 1..v_p2_count LOOP
      v_correct_sub_count := 0;
      v_p2_sub_details := '{}'::jsonb;
      FOREACH v_sub IN ARRAY v_sub_items LOOP
        v_ans_sub := LOWER(TRIM(COALESCE(p_answers->'part_2'->v_q_idx::text->>v_sub, '')));
        v_key_sub := LOWER(TRIM(COALESCE(v_keys->'part_2'->v_q_idx::text->>v_sub, '')));
        IF v_ans_sub <> '' AND v_ans_sub = v_key_sub THEN
          v_correct_sub_count := v_correct_sub_count + 1;
          v_p2_sub_details := jsonb_set(v_p2_sub_details, ARRAY[v_sub], 'true'::jsonb);
        ELSE
          v_p2_sub_details := jsonb_set(v_p2_sub_details, ARRAY[v_sub], 'false'::jsonb);
        END IF;
      END LOOP;
      CASE v_correct_sub_count
        WHEN 1 THEN v_ratio := 0.10;
        WHEN 2 THEN v_ratio := 0.25;
        WHEN 3 THEN v_ratio := 0.50;
        WHEN 4 THEN v_ratio := 1.00;
        ELSE v_ratio := 0.00;
      END CASE;
      v_p2_score := ROUND(v_ratio * v_p2_base, 3);
      v_s2 := v_s2 + v_p2_score;
      v_total_score := v_total_score + v_p2_score;
      v_score_details := jsonb_set(v_score_details, ARRAY['part_2', v_q_idx::text],
        jsonb_build_object('correct_count', v_correct_sub_count, 'score', ROUND(v_p2_score, 2), 'details', v_p2_sub_details));
    END LOOP;
  END IF;

  -- PHẦN III (Chuẩn hóa dấu , và ., dung sai số thực 1e-6 đồng nhất với Frontend)
  IF v_p3_count > 0 THEN
    FOR v_q_idx IN 1..v_p3_count LOOP
      v_clean_key := LOWER(REPLACE(REGEXP_REPLACE(COALESCE(v_keys->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.'));
      v_clean_ans := LOWER(REPLACE(REGEXP_REPLACE(COALESCE(p_answers->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.'));
      v_clean_key := REGEXP_REPLACE(v_clean_key, '^\+', '');
      v_clean_ans := REGEXP_REPLACE(v_clean_ans, '^\+', '');
      IF v_clean_ans <> '' AND v_clean_key <> '' AND (
           v_clean_ans = v_clean_key
           OR (v_clean_ans ~ '^-?[0-9]*\.?[0-9]+$' AND v_clean_key ~ '^-?[0-9]*\.?[0-9]+$'
               AND ABS(v_clean_ans::numeric - v_clean_key::numeric) < 0.000001)
      ) THEN
        v_s3 := v_s3 + v_p3_unit;
        v_total_score := v_total_score + v_p3_unit;
        v_score_details := jsonb_set(v_score_details, ARRAY['part_3', v_q_idx::text],
          jsonb_build_object('is_correct', true, 'score', ROUND(v_p3_unit, 2), 'student_ans', v_clean_ans, 'key', v_clean_key));
      ELSE
        v_score_details := jsonb_set(v_score_details, ARRAY['part_3', v_q_idx::text],
          jsonb_build_object('is_correct', false, 'score', 0, 'student_ans', v_clean_ans, 'key', v_clean_key));
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'score', ROUND(v_total_score, 2),
    'score_part_1', ROUND(v_s1, 2),
    'score_part_2', ROUND(v_s2, 2),
    'score_part_3', ROUND(v_s3, 2),
    'details', v_score_details
  );
END $$;
REVOKE ALL ON FUNCTION public.grade_answers(jsonb,jsonb,jsonb) FROM public, anon, authenticated;

-- 5. CẬP NHẬT start_attempt & submit_and_grade_exam (BẮT BUỘC QUA check_exam_schedule)
CREATE OR REPLACE FUNCTION public.start_attempt(
  p_exam_id uuid, p_session_token uuid, p_student_name text, p_class_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_started timestamptz; v_owner uuid; v_secret text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập'; END IF;

  -- Kiểm tra quyền truy cập đề (bao gồm is_private + lớp học + khung giờ)
  PERFORM public.check_exam_schedule(p_exam_id, interval '0 seconds');

  v_secret := encode(gen_random_bytes(24), 'base64');
  INSERT INTO submissions (exam_id, student_id, student_name, class_name, session_token, status, rescue_secret)
  VALUES (p_exam_id, v_uid, COALESCE(NULLIF(TRIM(p_student_name),''), 'Học sinh'), p_class_name, p_session_token, 'in_progress', v_secret)
  ON CONFLICT (exam_id, session_token) DO NOTHING;

  UPDATE submissions SET rescue_secret = v_secret
  WHERE exam_id = p_exam_id AND session_token = p_session_token AND student_id = v_uid
    AND rescue_secret IS NULL AND status <> 'submitted';

  SELECT started_at, student_id, rescue_secret INTO v_started, v_owner, v_secret
  FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF v_owner IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
  RETURN jsonb_build_object('started_at', v_started, 'rescue_secret', v_secret);
END $$;

REVOKE ALL ON FUNCTION public.start_attempt(uuid, uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_attempt(uuid, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_and_grade_exam(
  p_exam_id uuid,
  p_session_token uuid,
  p_student_name text,
  p_class_name text,
  p_answers jsonb,
  p_cheat_count int,
  p_total_away_seconds int,
  p_student_id uuid DEFAULT NULL,
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
  v_grade JSONB;
  v_total_score NUMERIC(5,2) := 0.0;
  v_s1 NUMERIC(5,2) := 0.0;
  v_s2 NUMERIC(5,2) := 0.0;
  v_s3 NUMERIC(5,2) := 0.0;
  v_score_details JSONB;
  v_attempt INT;
  v_class UUID;
  v_telemetry JSONB := COALESCE(p_telemetry, '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập để nộp bài'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  -- Kiểm tra quyền truy cập đề & khung giờ với dung sai 3 phút
  PERFORM public.check_exam_schedule(p_exam_id, interval '3 minutes');

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;
  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object(
    'part_1', v_kr.part_1_keys,
    'part_2', v_kr.part_2_keys,
    'part_3', v_kr.part_3_keys,
    'solutions', COALESCE(v_kr.solutions, '{}'::jsonb)
  );

  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF FOUND THEN
    IF v_prev.student_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
    IF v_prev.status = 'submitted' THEN
      RETURN jsonb_build_object('status','success','score', v_prev.total_score,
                                'score_details', v_prev.score_details, 'answer_keys', v_keys);
    END IF;
    IF v_exam.duration_minutes > 0
       AND now() > v_prev.started_at + make_interval(mins => v_exam.duration_minutes) + INTERVAL '3 minutes' THEN
      RAISE EXCEPTION 'Đã quá thời gian làm bài';
    END IF;
  END IF;

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
  v_total_score := COALESCE((v_grade->>'score')::numeric, 0);
  v_s1 := COALESCE((v_grade->>'score_part_1')::numeric, 0);
  v_s2 := COALESCE((v_grade->>'score_part_2')::numeric, 0);
  v_s3 := COALESCE((v_grade->>'score_part_3')::numeric, 0);
  v_score_details := v_grade->'details';

  INSERT INTO submissions (
    exam_id, session_token, student_name, class_name, answers, student_answers,
    score_part_1, score_part_2, score_part_3, score, total_score,
    score_details, cheat_count, total_away_seconds, telemetry_logs, attempt_number, status, submitted_at,
    student_id, class_id, school
  ) VALUES (
    p_exam_id, p_session_token, COALESCE(NULLIF(TRIM(p_student_name),''), 'Học sinh'), p_class_name,
    p_answers, p_answers,
    v_s1, v_s2, v_s3, ROUND(v_total_score, 2), ROUND(v_total_score, 2),
    v_score_details, GREATEST(COALESCE(p_cheat_count,0),0), GREATEST(COALESCE(p_total_away_seconds,0),0),
    v_telemetry, v_attempt, 'submitted', now(), v_uid, v_class, p_school
  )
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
    answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
    score_part_1 = EXCLUDED.score_part_1, score_part_2 = EXCLUDED.score_part_2, score_part_3 = EXCLUDED.score_part_3,
    score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
    cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
    telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
    status = 'submitted', submitted_at = now(),
    class_id = COALESCE(EXCLUDED.class_id, submissions.class_id),
    school = COALESCE(EXCLUDED.school, submissions.school);

  RETURN jsonb_build_object('status','success','score', ROUND(v_total_score, 2),
                            'score_details', v_score_details, 'answer_keys', v_keys);
END $$;

-- 6. TRIỆT TIÊU ROW LOCK CONTENTION TRÊN teacher_stats KHI NỘP BÀI ĐỒNG LOẠT
CREATE OR REPLACE FUNCTION public.trg_submissions_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_teacher uuid;
BEGIN
  IF NEW.status = 'submitted' THEN
    -- Cập nhật thống kê của riêng học sinh vừa nộp (1 dòng riêng biệt theo student_id -> không tranh chấp khóa)
    PERFORM public.recompute_student_stats(NEW.student_id);

    -- CHỈ tính lại teacher_stats nếu đây là bài nộp thành công ĐẦU TIÊN của đề thi này trong năm học hiện tại!
    -- Các bài nộp thứ 2..300 của cùng đề thi không làm thay đổi số lượng đề đủ điều kiện (exams_count) của giáo viên.
    IF NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.exam_id = NEW.exam_id
        AND s.status = 'submitted'
        AND s.id <> NEW.id
        AND s.submitted_at >= public.academic_year_start()
    ) THEN
      SELECT COALESCE(created_by, author_id) INTO v_teacher FROM public.exams WHERE id = NEW.exam_id;
      PERFORM public.recompute_teacher_stats(v_teacher);
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 7. CHO PHÉP get_my_rank NHẬN THAM SỐ p_force_role ĐỂ HIỂN THỊ ĐÚNG KHI GIÁO VIÊN XEM CỔNG HỌC SINH
CREATE OR REPLACE FUNCTION public.get_my_rank(p_force_role text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_result jsonb; v_season text := public.academic_year_tag();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  IF p_force_role IN ('teacher', 'student') THEN
    v_role := p_force_role;
  ELSE
    SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  END IF;

  IF v_role = 'teacher' THEN
    SELECT jsonb_build_object(
      'role', 'teacher', 'exams_count', t.exams_count, 'rank_tier', t.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.teacher_stats WHERE season_tag = v_season AND exams_count > t.exams_count)
    ) INTO v_result
    FROM public.teacher_stats t WHERE t.teacher_id = v_uid AND t.season_tag = v_season;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'teacher', 'exams_count', 0, 'rank_tier', public.teacher_rank_tier(0), 'position', NULL));
  ELSE
    SELECT jsonb_build_object(
      'role', 'student', 'exams_completed', s.exams_completed, 'avg_score', s.avg_score,
      'rank_score', s.rank_score, 'rank_tier', s.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.student_stats WHERE season_tag = v_season AND rank_score > s.rank_score)
    ) INTO v_result
    FROM public.student_stats s WHERE s.student_id = v_uid AND s.season_tag = v_season;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'student', 'exams_completed', 0, 'avg_score', 0,
      'rank_score', 0, 'rank_tier', public.student_rank_tier(0), 'position', NULL));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_my_rank(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_rank(text) TO authenticated;
