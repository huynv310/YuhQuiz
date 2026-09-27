-- Dedup PDF đề: tên tệp mới là SHA-256 nội dung (exams/<64 hex>.pdf) nên nhiều đề có thể
-- dùng chung 1 tệp vật lý. Do đó khi xóa đề chỉ được xóa tệp nếu KHÔNG còn đề nào khác
-- tham chiếu (trước đây xóa vô điều kiện). Vẫn nhận dạng cả tên cũ <timestamp>_<random>.<ext>.

CREATE OR REPLACE FUNCTION public.extract_exam_pdf_paths(t text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT m[1]), '{}')
  FROM regexp_matches(COALESCE(t, ''),
    '(exams/(?:[0-9a-f]{64}|[0-9]+_[0-9a-z]+)\.[A-Za-z0-9]+)', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION public.release_exam_pdf_paths(p_paths text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY COALESCE(p_paths, '{}') LOOP
    CONTINUE WHEN p IS NULL OR p !~ '^exams/([0-9a-f]{64}|[0-9]+_[0-9a-z]+)\.[A-Za-z0-9]+$';
    -- Trigger chạy AFTER DELETE: hàng của đề vừa xóa đã biến mất, chỉ còn các đề khác.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.exams
       WHERE position(p in COALESCE(pdf_url, '') || ' ' || COALESCE(pdf_r2_url, '')) > 0);
    DELETE FROM storage.objects WHERE bucket_id = 'exam-pdfs' AND name = p;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.extract_exam_pdf_paths(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_exam_pdf_paths(text[]) FROM PUBLIC, anon, authenticated;
