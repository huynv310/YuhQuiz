-- Supabase managed Postgres chặn ALTER DATABASE / ALTER ROLE ... SET <custom-param>
-- (role "postgres" trên đó không phải superuser thật, lỗi 42501 permission denied).
-- Chuyển chỗ lưu secret từ GUC database sang 1 bảng khóa kín — chỉ cần INSERT thường,
-- không cần quyền admin cấp hệ thống.
--
-- Cần cấu hình 1 lần (Supabase Dashboard → SQL Editor), thay '<secret>' bằng chuỗi đã
-- dùng cho biến môi trường Vercel RL_INTERNAL_SECRET:
--   INSERT INTO public._rl_secret (id, secret) VALUES (true, '<secret>')
--   ON CONFLICT (id) DO UPDATE SET secret = EXCLUDED.secret;

CREATE TABLE IF NOT EXISTS public._rl_secret (
  id boolean PRIMARY KEY DEFAULT true,
  secret text NOT NULL,
  CONSTRAINT _rl_secret_single_row CHECK (id)
);
ALTER TABLE public._rl_secret ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._rl_secret FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._rl_internal_ok() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text; v_hdr text;
BEGIN
  SELECT secret INTO v_secret FROM public._rl_secret WHERE id = true;
  IF v_secret IS NULL OR v_secret = '' THEN RETURN false; END IF;
  BEGIN
    v_hdr := current_setting('request.headers', true)::json->>'x-yq-rl-secret';
  EXCEPTION WHEN OTHERS THEN v_hdr := NULL; END;
  RETURN v_hdr IS NOT NULL AND v_hdr = v_secret;
END $$;
