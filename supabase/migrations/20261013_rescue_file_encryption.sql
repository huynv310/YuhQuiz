-- File cứu hộ .yuhquiz trước đây là JSON THUẦN TÚY — học sinh mất mạng có thể mở file bằng
-- Notepad, tra được đáp án đúng ở đâu đó trong lúc offline rồi tự sửa answers/cheat_count trước
-- khi gửi giáo viên nhập lại. Server tuy chấm lại điểm từ answers (không tin điểm client tự
-- gửi) nhưng KHÔNG có cách nào phát hiện answers đã bị sửa tay sau khi xuất file.
--
-- Sửa: mỗi phiên thi được cấp 1 "rescue_secret" ngẫu nhiên ngay khi start_attempt() thành công
-- (chỉ máy chủ + đúng trình duyệt học sinh đó biết — không lộ qua SELECT thường, chỉ trả về qua
-- RPC). Lúc xuất file, trình duyệt học sinh dùng secret này để:
--   1) MÃ HÓA phần đáp án/telemetry (AES-256-CBC) — file không còn đọc/sửa được bằng mắt thường.
--   2) KÝ (HMAC-SHA256) toàn bộ nội dung — bất kỳ sửa đổi nào (kể cả 1 bit) đều làm sai chữ ký.
-- Khi giáo viên nhập file, teacher_import_rescue() tự xác minh chữ ký NGAY TRÊN SERVER bằng
-- rescue_secret lưu sẵn (không tin bất kỳ khẳng định nào từ trình duyệt giáo viên). Nếu chữ ký
-- sai → không giải mã được nội dung thật, tự động chấm 0 điểm và gắn flagged_fraud = true để
-- giáo viên biết bài này đáng ngờ thay vì âm thầm từ chối nhập.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS rescue_secret text;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS flagged_fraud boolean NOT NULL DEFAULT false;

-- Không cho đọc rescue_secret qua SELECT thường (kể cả của chính học sinh) — chỉ phát ra qua
-- RPC start_attempt() lúc tạo phiên, để không lộ qua bất kỳ truy vấn bảng nào sau đó.
REVOKE SELECT (rescue_secret) ON public.submissions FROM authenticated;

-- Đổi kiểu trả về (timestamptz → jsonb) nên phải DROP trước, CREATE OR REPLACE không cho đổi
-- kiểu trả về của hàm đã tồn tại.
DROP FUNCTION IF EXISTS public.start_attempt(uuid, uuid, text, text);
CREATE OR REPLACE FUNCTION public.start_attempt(
  p_exam_id uuid, p_session_token uuid, p_student_name text, p_class_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_exam RECORD; v_started timestamptz; v_owner uuid; v_secret text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.'; END IF;
  IF v_exam.start_at IS NOT NULL AND now() < v_exam.start_at THEN RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở'; END IF;
  IF v_exam.end_at IS NOT NULL AND now() > v_exam.end_at THEN RAISE EXCEPTION 'Kỳ thi đã kết thúc'; END IF;

  v_secret := encode(gen_random_bytes(24), 'base64');
  INSERT INTO submissions (exam_id, student_id, student_name, class_name, session_token, status, rescue_secret)
  VALUES (p_exam_id, v_uid, COALESCE(NULLIF(p_student_name,''), 'Học sinh'), p_class_name, p_session_token, 'in_progress', v_secret)
  ON CONFLICT (exam_id, session_token) DO NOTHING;

  SELECT started_at, student_id, rescue_secret INTO v_started, v_owner, v_secret
  FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF v_owner IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
  RETURN jsonb_build_object('started_at', v_started, 'rescue_secret', v_secret);
END $$;

-- Nhập file cứu hộ: nhận nguyên file đã mã hóa + ký (client không giải mã được vì không biết
-- rescue_secret), server tự xác minh chữ ký và giải mã bằng secret lưu ở dòng submissions.
CREATE OR REPLACE FUNCTION public.teacher_import_rescue(
  p_exam_id uuid, p_student_id uuid, p_file jsonb, p_class_name text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD; v_kr RECORD; v_keys jsonb; v_grade jsonb; v_prev RECORD;
  v_name text; v_attempt int; v_class_name text;
  v_session_token uuid; v_aad text; v_iv bytea; v_ct bytea; v_mac bytea;
  v_mac_key bytea; v_enc_key bytea; v_plain text; v_payload jsonb; v_ok boolean;
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
        score, total_score, score_details, cheat_count, total_away_seconds, telemetry_logs,
        attempt_number, status, submitted_at, flagged_fraud)
    VALUES (p_exam_id, v_session_token, p_student_id, COALESCE(NULLIF(v_name,''),'Học sinh'), v_class_name,
        '{}'::jsonb, '{}'::jsonb, 0, 0, '{}'::jsonb, v_prev.cheat_count, v_prev.total_away_seconds,
        '[{"type":"rescue_file_tampered"}]'::jsonb, v_attempt, 'submitted', now(), true)
    ON CONFLICT (exam_id, session_token) DO UPDATE SET
        student_name = EXCLUDED.student_name, class_name = EXCLUDED.class_name,
        score = 0, total_score = 0, score_details = '{}'::jsonb,
        telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
        status = 'submitted', submitted_at = now(), flagged_fraud = true;
    RETURN jsonb_build_object('status','fraud_detected','score',0,'student_name',v_name);
  END IF;

  v_enc_key := digest('enc|' || v_prev.rescue_secret, 'sha256');
  v_plain := convert_from(decrypt_iv(v_ct, v_enc_key, v_iv, 'aes-cbc/pad:pkcs'), 'UTF8');
  v_payload := v_plain::jsonb;

  v_grade := public.grade_answers(v_exam.config, v_keys, coalesce(v_payload->'answers', '{}'::jsonb));

  INSERT INTO submissions (exam_id, session_token, student_id, student_name, class_name, answers, student_answers,
      score, total_score, score_details, cheat_count, total_away_seconds, telemetry_logs,
      attempt_number, status, submitted_at, flagged_fraud)
  VALUES (p_exam_id, v_session_token, p_student_id, COALESCE(NULLIF(v_name,''),'Học sinh'), v_class_name,
      coalesce(v_payload->'answers','{}'::jsonb), coalesce(v_payload->'answers','{}'::jsonb),
      (v_grade->>'score')::numeric, (v_grade->>'score')::numeric, v_grade->'details',
      GREATEST(COALESCE((v_payload->>'cheatCount')::int,0),0), GREATEST(COALESCE((v_payload->>'totalAwaySecs')::int,0),0),
      '[{"type":"imported_from_rescue_file"}]'::jsonb, v_attempt, 'submitted', now(), false)
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
      student_name = EXCLUDED.student_name, class_name = EXCLUDED.class_name,
      answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
      score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
      cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
      telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
      status = 'submitted', submitted_at = now(), flagged_fraud = false;

  RETURN jsonb_build_object('status','success','score',(v_grade->>'score')::numeric,'student_name',v_name);
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = 'P0001' THEN RAISE; END IF; -- lỗi RAISE EXCEPTION tường minh ở trên: giữ nguyên
  -- Mọi lỗi giải mã/định dạng khác (base64 hỏng, JSON hỏng sau giải mã...) đều coi là file hỏng.
  RAISE EXCEPTION 'File cứu hộ không hợp lệ hoặc đã hỏng';
END $$;
DROP FUNCTION IF EXISTS public.teacher_import_rescue(uuid, uuid, uuid, jsonb, int, int, text);
REVOKE ALL ON FUNCTION public.teacher_import_rescue(uuid,uuid,jsonb,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_import_rescue(uuid,uuid,jsonb,text) TO authenticated;
REVOKE ALL ON FUNCTION public.start_attempt(uuid,uuid,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_attempt(uuid,uuid,text,text) TO authenticated;

-- Cho chính học sinh lấy lại rescue_secret của phiên thi CỦA MÌNH (đổi máy, hoặc xuất lại bản
-- sao bài đã nộp) — chỉ trả về đúng chủ sở hữu (auth.uid() = student_id), không ai khác đọc được.
CREATE OR REPLACE FUNCTION public.student_fetch_rescue_secret(p_session_token uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text;
BEGIN
  SELECT rescue_secret INTO v_secret FROM submissions
   WHERE session_token = p_session_token AND student_id = auth.uid();
  RETURN v_secret;
END $$;
REVOKE ALL ON FUNCTION public.student_fetch_rescue_secret(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.student_fetch_rescue_secret(uuid) TO authenticated;
