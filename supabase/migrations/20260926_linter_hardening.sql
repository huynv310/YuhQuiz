-- Xử lý cảnh báo Supabase linter (0011, 0025, 0028, 0029).

-- 0011: cố định search_path
ALTER FUNCTION public._b36(bigint, int) SET search_path = public;
ALTER FUNCTION public.subject_abbr(text) SET search_path = public;
ALTER FUNCTION public.gen_exam_short_id(text, uuid) SET search_path = public;
ALTER FUNCTION public.exams_lock_identity() SET search_path = public;
ALTER FUNCTION public.exam_keys_limit() SET search_path = public;
ALTER FUNCTION public.extract_storage_paths(text) SET search_path = public;

-- 0028/0029: hàm trigger không cần (và không được) gọi qua /rest/v1/rpc
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['handle_new_user','exams_set_author','profiles_guard','profiles_set_user_code',
                           'rls_auto_enable','trg_answer_keys_release','trg_exams_release','trg_question_bank_release']
  LOOP
    IF to_regprocedure('public.' || f || '()') IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', f);
    END IF;
  END LOOP;
END $$;

-- Hàm hỗ trợ RLS: chỉ người đã đăng nhập cần dùng
REVOKE ALL ON FUNCTION public.is_class_member(uuid), public.is_my_teacher(uuid), public.is_teacher(),
  public.owns_class(uuid), public.owns_exam(uuid), public.teaches_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_member(uuid), public.is_my_teacher(uuid), public.is_teacher(),
  public.owns_class(uuid), public.owns_exam(uuid), public.teaches_student(uuid) TO authenticated;

-- Chỉ dùng cho BFF/đăng nhập: giới hạn tốc độ giữ cho anon (cần trước khi đăng nhập). Không đổi.

-- 0025: bucket public không cần policy SELECT để mở bằng URL; bỏ để không liệt kê được toàn bộ tệp
DROP POLICY IF EXISTS "qimg_select" ON storage.objects;
DROP POLICY IF EXISTS "qimg_select_own" ON storage.objects;
DROP POLICY IF EXISTS "Cho phép đọc file từ exam-pdfs" ON storage.objects;
-- Người dùng chỉ thấy tệp trong thư mục của chính mình (upload/xóa qua API cần quyền SELECT)
CREATE POLICY "qimg_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-images' AND (storage.foldername(name))[1] = auth.uid()::text);
