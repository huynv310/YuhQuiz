-- Lỗ hổng dọn dữ liệu: trg_exams_release() (20260925) chỉ nhận diện & xóa tệp theo quy ước
-- đặt tên của bucket question-images (<uuid>/<hash>.ext). Đề thi PDF lại nằm ở bucket
-- exam-pdfs, đường dẫn dạng exams/<timestamp>_<random>.<ext> (xem CreateExamModal.tsx,
-- handlePdfUpload) → khi giáo viên xóa đề, tệp PDF gốc KHÔNG bao giờ bị xóa khỏi Storage,
-- trở thành dữ liệu mồ côi tồn tại vĩnh viễn. Bổ sung nhánh dọn riêng cho bucket này.

CREATE OR REPLACE FUNCTION public.extract_exam_pdf_paths(t text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT m[1]), '{}')
  FROM regexp_matches(COALESCE(t, ''), '(exams/[0-9]+_[0-9a-z]+\.[A-Za-z0-9]+)', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION public.release_exam_pdf_paths(p_paths text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY COALESCE(p_paths, '{}') LOOP
    CONTINUE WHEN p IS NULL OR p !~ '^exams/[0-9]+_[0-9a-z]+\.[A-Za-z0-9]+$';
    DELETE FROM storage.objects WHERE bucket_id = 'exam-pdfs' AND name = p;
  END LOOP;
END $$;

-- Mở rộng trigger sẵn có (chạy AFTER DELETE ON exams) để dọn thêm bucket exam-pdfs.
CREATE OR REPLACE FUNCTION public.trg_exams_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.release_storage_paths(public.extract_storage_paths(
    COALESCE(OLD.config::text, '') || ' ' || COALESCE(OLD.pdf_r2_url, '') || ' ' || COALESCE(OLD.pdf_url, '')));
  PERFORM public.release_exam_pdf_paths(public.extract_exam_pdf_paths(
    COALESCE(OLD.pdf_r2_url, '') || ' ' || COALESCE(OLD.pdf_url, '')));
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.extract_exam_pdf_paths(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_exam_pdf_paths(text[]) FROM PUBLIC, anon, authenticated;
