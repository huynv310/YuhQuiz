-- Mã người dùng 8 ký tự: 2 ký tự đầu = vai trò (GV / HS), 6 ký tự sau ngẫu nhiên, duy nhất.
-- Sinh ở máy chủ; client không chọn được và không sửa được.
CREATE OR REPLACE FUNCTION public.gen_user_code(p_role text) RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alphabet CONSTANT text := '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- bỏ I, O cho khỏi nhầm với 1, 0
  pre text := CASE WHEN p_role = 'teacher' THEN 'GV' ELSE 'HS' END;
  code text; i int;
BEGIN
  LOOP
    code := pre;
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_code = code);
  END LOOP;
  RETURN code;
END $$;

-- Cấp lại mã cho hồ sơ cũ (định dạng cũ hoặc trống). Làm TRƯỚC khi tạo trigger khóa.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles
           WHERE user_code IS NULL OR user_code !~ '^(GV|HS)[0-9A-Z]{6}$' LOOP
    UPDATE public.profiles SET user_code = public.gen_user_code(r.role) WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.profiles_set_user_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.user_code := public.gen_user_code(NEW.role);
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.user_code := public.gen_user_code(NEW.role);   -- hoàn tất hồ sơ đổi vai trò → đổi tiền tố
  ELSE
    NEW.user_code := OLD.user_code;                    -- không cho sửa
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_user_code ON public.profiles;
CREATE TRIGGER trg_profiles_user_code BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_set_user_code();

REVOKE ALL ON FUNCTION public.gen_user_code(text) FROM PUBLIC, anon, authenticated;
