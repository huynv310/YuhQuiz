-- Sửa: các phiên start_attempt() được TẠO TRƯỚC migration 20261013 (mã hóa file cứu hộ) không có
-- rescue_secret, vì lúc đó cột này chưa cấp giá trị. Vì INSERT dùng ON CONFLICT DO NOTHING, các lần
-- gọi start_attempt() sau đó cho phiên đã tồn tại sẽ KHÔNG cấp lại secret — hàm vẫn trả về thành công
-- nhưng rescue_secret luôn là NULL, khiến nút "Xuất .yuhquiz" báo lỗi vĩnh viễn dù đợi bao lâu.
-- Sửa gốc: nếu phiên đã tồn tại mà chưa có rescue_secret, cấp bù ngay lúc gọi lại.
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

  -- Phiên đã tồn tại từ trước migration mã hóa (rescue_secret NULL) và chưa nộp: cấp bù ngay.
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
