-- Dọn phần còn sót từ schema cũ (theo Supabase linter). Idempotent.

-- 1) Bản chấm bài 7 tham số (cũ) còn lại trong DB production
DROP FUNCTION IF EXISTS public.submit_and_grade_exam(uuid, uuid, text, text, jsonb, int, int);

-- 2) teacher_profiles (bảng cũ): bỏ policy INSERT luôn đúng, bật RLS
DO $$ BEGIN
  IF to_regclass('public.teacher_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Cho phép tạo teacher_profiles" ON public.teacher_profiles;
    ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 3) Chuyển extension khỏi schema public (index gin hiện có không bị ảnh hưởng)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
               WHERE e.extname = 'pg_trgm' AND n.nspname = 'public') THEN
      ALTER EXTENSION pg_trgm SET SCHEMA extensions;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
               WHERE e.extname = 'unaccent' AND n.nspname = 'public') THEN
      ALTER EXTENSION unaccent SET SCHEMA extensions;
    END IF;
  END IF;
END $$;
