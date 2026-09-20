-- Kho bài tập: phân loại theo môn + khối; bỏ chương SGK, dùng #hashtag (topic_tags).
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Toán';
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS grade INT NOT NULL DEFAULT 12;
ALTER TABLE public.question_bank DROP CONSTRAINT IF EXISTS question_bank_grade_range;
ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_grade_range CHECK (grade BETWEEN 1 AND 12);
ALTER TABLE public.question_bank ALTER COLUMN chapter_name DROP NOT NULL;
ALTER TABLE public.question_bank ALTER COLUMN chapter_name SET DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_question_bank_tags ON public.question_bank USING GIN (topic_tags);
CREATE INDEX IF NOT EXISTS idx_question_bank_subject_grade ON public.question_bank (subject, grade);
