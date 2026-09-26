-- auth_rl_fail / auth_rl_reset hiện GRANT cho anon: bất kỳ ai tính được
-- sha256(ip|email) (ví dụ tự chọn IP nguồn của mình + email nạn nhân) đều có
-- thể tự gọi RPC để làm đầy hoặc xóa trắng bộ đếm rate-limit của người khác,
-- vô hiệu hóa hoàn toàn cơ chế chống brute-force.
-- Cách sửa: KHÔNG dùng service_role (dự án không dùng key admin). Thay vào đó
-- chỉ cho phép BFF gọi 2 hàm này bằng cách kiểm tra một secret dùng chung,
-- BFF gửi qua header HTTP tùy biến (PostgREST expose qua GUC request.headers).
--
-- Cần cấu hình 1 lần trên Supabase (Dashboard → SQL Editor), thay '<secret>'
-- bằng 1 chuỗi ngẫu nhiên dài (vd: openssl rand -hex 32):
--   ALTER DATABASE postgres SET app.rl_internal_secret = '<secret>';
-- rồi đặt cùng giá trị đó vào biến môi trường Vercel: RL_INTERNAL_SECRET.

CREATE OR REPLACE FUNCTION public._rl_internal_ok() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text; v_hdr text;
BEGIN
  v_secret := current_setting('app.rl_internal_secret', true);
  IF v_secret IS NULL OR v_secret = '' THEN RETURN false; END IF;
  BEGIN
    v_hdr := current_setting('request.headers', true)::json->>'x-yq-rl-secret';
  EXCEPTION WHEN OTHERS THEN v_hdr := NULL; END;
  RETURN v_hdr IS NOT NULL AND v_hdr = v_secret;
END $$;

CREATE OR REPLACE FUNCTION public.auth_rl_fail(p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._rl_internal_ok() THEN RAISE EXCEPTION 'Không có quyền'; END IF;
  IF p_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Tham số không hợp lệ'; END IF;
  IF (SELECT count(*) FROM auth_attempts WHERE key = p_key AND at > now() - interval '1 day') < 50 THEN
    INSERT INTO auth_attempts(key) VALUES (p_key);
  END IF;
  IF random() < 0.05 THEN DELETE FROM auth_attempts WHERE at < now() - interval '1 day'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auth_rl_reset(p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._rl_internal_ok() THEN RAISE EXCEPTION 'Không có quyền'; END IF;
  IF p_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Tham số không hợp lệ'; END IF;
  DELETE FROM auth_attempts WHERE key = p_key;
END $$;

REVOKE ALL ON FUNCTION public._rl_internal_ok() FROM PUBLIC, anon, authenticated;
