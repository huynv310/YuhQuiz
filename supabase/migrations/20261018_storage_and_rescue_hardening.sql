-- 20261018_storage_and_rescue_hardening.sql
-- 1. Bảo mật và phân quyền Storage Bucket 'exam-pdfs': chỉ giáo viên được tải tệp lên thư mục exams/
-- 2. Đồng bộ hóa điểm thành phần (score_part_1, score_part_2, score_part_3) trong teacher_import_rescue

-- 1. STORAGE: exam-pdfs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exam-pdfs', 'exam-pdfs', true, 104857600, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "exam_pdfs_teacher_insert" ON storage.objects;
CREATE POLICY "exam_pdfs_teacher_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exam-pdfs'
    AND public.is_teacher()
    AND name LIKE 'exams/%'
  );

DROP POLICY IF EXISTS "exam_pdfs_select" ON storage.objects;
CREATE POLICY "exam_pdfs_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'exam-pdfs');

-- 2. NÂNG CẤP teacher_import_rescue: CẬP NHẬT ĐIỂM THÀNH PHẦN (PART 1, 2, 3)
CREATE OR REPLACE FUNCTION public.teacher_import_rescue(
  p_exam_id uuid, p_student_id uuid, p_file jsonb, p_class_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD; v_kr RECORD; v_keys jsonb; v_grade jsonb; v_prev RECORD;
  v_name text; v_attempt int; v_class_name text;
  v_session_token uuid; v_aad text; v_iv bytea; v_ct bytea; v_mac bytea;
  v_mac_key bytea; v_enc_key bytea; v_plain text; v_payload jsonb; v_ok boolean;
  v_p1_score numeric; v_p2_score numeric; v_p3_score numeric;
BEGIN
  IF NOT public.owns_exam(p_exam_id) THEN RAISE EXCEPTION 'Bạn không sở hữu đề này'; END IF;
  IF length(p_file::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  v_session_token := NULLIF(p_file->>'sessionToken','')::uuid;
  IF v_session_token IS NULL THEN RAISE EXCEPTION 'File cứu hộ thiếu sessionToken'; END IF;

  -- Bắt buộc phải có phiên làm bài THẬT do chính học sinh đó tạo (qua start_attempt) khớp cả
  -- exam_id + session_token + student_id — chứng minh học sinh đã thật sự tham gia đề này.
  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = v_session_token;
  IF NOT FOUND OR v_prev.student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'Học sinh này chưa từng bắt đầu làm đề — không thể nhập cứu hộ';
  END IF;
  IF v_prev.status = 'submitted' THEN
    RAISE EXCEPTION 'Bài này đã được nộp/nhập trước đó';
  END IF;
  IF v_prev.rescue_secret IS NULL THEN
    RAISE EXCEPTION 'Phiên làm bài này không hỗ trợ cứu hộ có ký số';
  END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys);

  SELECT full_name INTO v_name FROM profiles WHERE id = p_student_id AND role = 'student';
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy học sinh'; END IF;

  v_class_name := NULLIF(p_class_name, '');
  IF v_class_name IS NULL THEN v_class_name := NULLIF(v_prev.class_name, ''); END IF;
  IF v_class_name IS NULL THEN
    SELECT c.name INTO v_class_name FROM class_memberships m JOIN classrooms c ON c.id = m.class_id
     WHERE m.student_id = p_student_id LIMIT 1;
  END IF;
  v_class_name := COALESCE(v_class_name, 'Chưa rõ lớp');

  SELECT count(*) + 1 INTO v_attempt FROM submissions
   WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'submitted';

  -- Xác minh chữ ký (HMAC-SHA256) trước khi thử giải mã bất cứ gì.
  v_aad := coalesce(p_file->>'sessionToken','') || '|' || coalesce(p_file->>'studentName','') || '|' || coalesce(p_file->>'className','');
  v_iv := decode(coalesce(p_file->>'iv',''), 'base64');
  v_ct := decode(coalesce(p_file->>'ct',''), 'base64');
  v_mac := decode(coalesce(p_file->>'mac',''), 'base64');
  v_mac_key := digest('mac|' || v_prev.rescue_secret, 'sha256');
  v_ok := (octet_length(v_mac) > 0) AND (hmac(v_iv || v_ct || convert_to(v_aad,'UTF8'), v_mac_key, 'sha256') = v_mac);

  IF NOT v_ok THEN
    -- Chữ ký sai: file đã bị sửa đổi sau khi xuất (hoặc giả mạo). Không thể tin nội dung answers
    -- nên KHÔNG giải mã/chấm điểm thật — ghi nhận 0 điểm và gắn cờ nghi vấn gian lận.
    INSERT INTO submissions (exam_id, session_token, student_id, student_name, class_name, answers, student_answers,
        score, total_score, score_part_1, score_part_2, score_part_3, score_details, cheat_count, total_away_seconds, telemetry_logs,
        attempt_number, status, submitted_at, flagged_fraud)
    VALUES (p_exam_id, v_session_token, p_student_id, COALESCE(NULLIF(v_name,''),'Học sinh'), v_class_name,
        '{}'::jsonb, '{}'::jsonb, 0, 0, 0, 0, 0, '{}'::jsonb, v_prev.cheat_count, v_prev.total_away_seconds,
        '[{"type":"rescue_file_tampered"}]'::jsonb, v_attempt, 'submitted', now(), true)
    ON CONFLICT (exam_id, session_token) DO UPDATE SET
        student_name = EXCLUDED.student_name, class_name = EXCLUDED.class_name,
        score = 0, total_score = 0, score_part_1 = 0, score_part_2 = 0, score_part_3 = 0, score_details = '{}'::jsonb,
        telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
        status = 'submitted', submitted_at = now(), flagged_fraud = true;
    RETURN jsonb_build_object('status','fraud_detected','score',0,'student_name',v_name);
  END IF;

  v_enc_key := digest('enc|' || v_prev.rescue_secret, 'sha256');
  v_plain := convert_from(decrypt_iv(v_ct, v_enc_key, v_iv, 'aes-cbc/pad:pkcs'), 'UTF8');
  v_payload := v_plain::jsonb;

  v_grade := public.grade_answers(v_exam.config, v_keys, coalesce(v_payload->'answers', '{}'::jsonb));
  v_p1_score := COALESCE((v_grade->>'score_part_1')::numeric, 0);
  v_p2_score := COALESCE((v_grade->>'score_part_2')::numeric, 0);
  v_p3_score := COALESCE((v_grade->>'score_part_3')::numeric, 0);

  INSERT INTO submissions (exam_id, session_token, student_id, student_name, class_name, answers, student_answers,
      score, total_score, score_part_1, score_part_2, score_part_3, score_details, cheat_count, total_away_seconds, telemetry_logs,
      attempt_number, status, submitted_at, flagged_fraud)
  VALUES (p_exam_id, v_session_token, p_student_id, COALESCE(NULLIF(v_name,''),'Học sinh'), v_class_name,
      coalesce(v_payload->'answers','{}'::jsonb), coalesce(v_payload->'answers','{}'::jsonb),
      (v_grade->>'score')::numeric, (v_grade->>'score')::numeric, v_p1_score, v_p2_score, v_p3_score, v_grade->'details',
      GREATEST(COALESCE((v_payload->>'cheatCount')::int,0),0), GREATEST(COALESCE((v_payload->>'totalAwaySecs')::int,0),0),
      '[{"type":"imported_from_rescue_file"}]'::jsonb, v_attempt, 'submitted', now(), false)
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
      student_name = EXCLUDED.student_name, class_name = EXCLUDED.class_name,
      answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
      score = EXCLUDED.score, total_score = EXCLUDED.total_score,
      score_part_1 = EXCLUDED.score_part_1, score_part_2 = EXCLUDED.score_part_2, score_part_3 = EXCLUDED.score_part_3,
      score_details = EXCLUDED.score_details,
      cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
      telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
      status = 'submitted', submitted_at = now(), flagged_fraud = false;

  RETURN jsonb_build_object('status','success','score',(v_grade->>'score')::numeric,'student_name',v_name);
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = 'P0001' THEN RAISE; END IF;
  RAISE EXCEPTION 'File cứu hộ không hợp lệ hoặc đã hỏng';
END $$;
