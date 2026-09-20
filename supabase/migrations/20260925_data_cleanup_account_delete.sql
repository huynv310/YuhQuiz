-- Giải phóng dữ liệu khi xóa + xóa tài khoản.
-- 1) Xóa câu hỏi / đề / sửa lời giải  → xóa luôn tệp trong Storage nếu không còn nơi nào dùng.
-- 2) question_bank.author_id ON DELETE CASCADE (trước đây chặn xóa tài khoản giáo viên).
-- 3) delete_my_account(): người dùng tự xóa tài khoản (kèm toàn bộ dữ liệu + tệp).

-- Đường dẫn tệp (<uid>/<hash>.webp hoặc <uid>/sol/<hash>.pdf) còn được tham chiếu ở đâu đó không?
CREATE OR REPLACE FUNCTION public.storage_path_in_use(p text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.question_bank
                  WHERE position(p in COALESCE(content_image_url, '')) > 0
                     OR position(p in COALESCE(solution_files::text, '')) > 0)
      OR EXISTS (SELECT 1 FROM public.exams WHERE position(p in COALESCE(config::text, '')) > 0)
      OR EXISTS (SELECT 1 FROM public.exam_answer_keys WHERE position(p in COALESCE(solutions::text, '')) > 0);
$$;

-- Xóa tệp nếu mồ côi. Chỉ đụng bucket question-images.
CREATE OR REPLACE FUNCTION public.release_storage_paths(p_paths text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY COALESCE(p_paths, '{}') LOOP
    CONTINUE WHEN p IS NULL OR p !~ '^[0-9a-f-]{36}/(sol/)?[0-9a-f]{64}\.(webp|png|jpg|jpeg|pdf)$';
    IF NOT public.storage_path_in_use(p) THEN
      DELETE FROM storage.objects WHERE bucket_id = 'question-images' AND name = p;
    END IF;
  END LOOP;
END $$;

-- Gom đường dẫn tệp từ chuỗi bất kỳ (JSON cấu hình, URL công khai...)
CREATE OR REPLACE FUNCTION public.extract_storage_paths(t text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT m[1]), '{}')
  FROM regexp_matches(COALESCE(t, ''), '([0-9a-f-]{36}/(?:sol/)?[0-9a-f]{64}\.(?:webp|png|jpg|jpeg|pdf))', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION public.trg_question_bank_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_p text[]; new_p text[];
BEGIN
  old_p := public.extract_storage_paths(COALESCE(OLD.content_image_url, '') || ' ' || COALESCE(OLD.solution_files::text, ''));
  IF TG_OP = 'UPDATE' THEN
    new_p := public.extract_storage_paths(COALESCE(NEW.content_image_url, '') || ' ' || COALESCE(NEW.solution_files::text, ''));
    old_p := ARRAY(SELECT unnest(old_p) EXCEPT SELECT unnest(new_p));
  END IF;
  PERFORM public.release_storage_paths(old_p);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_qb_release_del ON public.question_bank;
CREATE TRIGGER trg_qb_release_del AFTER DELETE ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.trg_question_bank_release();
DROP TRIGGER IF EXISTS trg_qb_release_upd ON public.question_bank;
CREATE TRIGGER trg_qb_release_upd AFTER UPDATE OF solution_files, content_image_url ON public.question_bank
  FOR EACH ROW EXECUTE FUNCTION public.trg_question_bank_release();

CREATE OR REPLACE FUNCTION public.trg_exams_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.release_storage_paths(public.extract_storage_paths(
    COALESCE(OLD.config::text, '') || ' ' || COALESCE(OLD.pdf_r2_url, '') || ' ' || COALESCE(OLD.pdf_url, '')));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_exams_release_del ON public.exams;
CREATE TRIGGER trg_exams_release_del AFTER DELETE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.trg_exams_release();

-- Tệp lời giải nằm trong exam_answer_keys.solutions: giải phóng khi khóa đáp án bị xóa (cascade từ đề)
CREATE OR REPLACE FUNCTION public.trg_answer_keys_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.release_storage_paths(public.extract_storage_paths(COALESCE(OLD.solutions::text, '')));
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS trg_ak_release_del ON public.exam_answer_keys;
CREATE TRIGGER trg_ak_release_del AFTER DELETE ON public.exam_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.trg_answer_keys_release();

-- question_bank không còn chặn xóa hồ sơ
ALTER TABLE public.question_bank DROP CONSTRAINT IF EXISTS question_bank_author_id_fkey;
ALTER TABLE public.question_bank
  ADD CONSTRAINT question_bank_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Người dùng tự xóa tài khoản. Xóa auth.users → cascade profiles → lớp, đề, bài nộp, câu hỏi...
CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirm text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); code text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập' USING ERRCODE = '28000'; END IF;
  SELECT user_code INTO code FROM public.profiles WHERE id = uid;
  IF code IS NULL OR upper(trim(COALESCE(p_confirm, ''))) <> code THEN
    RAISE EXCEPTION 'Mã xác nhận không đúng' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.exams WHERE author_id = uid OR created_by = uid;
  DELETE FROM public.question_bank WHERE author_id = uid;
  DELETE FROM storage.objects WHERE bucket_id = 'question-images' AND (storage.foldername(name))[1] = uid::text;
  DELETE FROM auth.users WHERE id = uid;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;

REVOKE ALL ON FUNCTION public.storage_path_in_use(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_storage_paths(text[]) FROM PUBLIC, anon, authenticated;
