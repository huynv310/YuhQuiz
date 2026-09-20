-- Lời giải chi tiết: văn bản + tệp đính kèm (ảnh WebP/PNG/JPEG hoặc PDF ≤ 2 MB).
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS solution_files JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.question_bank DROP CONSTRAINT IF EXISTS question_bank_solution_files_shape;
ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_solution_files_shape
  CHECK (jsonb_typeof(solution_files) = 'array' AND jsonb_array_length(solution_files) <= 5);

-- Bucket dùng chung: nới giới hạn để nhận PDF. Ảnh câu hỏi vẫn bị giới hạn 500 KB ở phía client.
UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/webp','image/png','image/jpeg','application/pdf']
WHERE id = 'question-images';
