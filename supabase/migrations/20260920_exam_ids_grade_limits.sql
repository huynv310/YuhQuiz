-- =====================================================================
-- 20260920: Mã đề 6 ký tự, khối lớp 1-12, giới hạn 100 câu / phần.
-- Chạy SAU 20260919_security_hardening.sql. Idempotent.
-- =====================================================================

-- 1. Khối lớp bắt buộc trong khoảng 1..12 ---------------------------------
UPDATE public.exams SET grade = 12 WHERE grade IS NULL OR grade NOT BETWEEN 1 AND 12;
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_grade_range;
ALTER TABLE public.exams ADD CONSTRAINT exams_grade_range CHECK (grade BETWEEN 1 AND 12);

-- 2. Mã đề: [môn][người tạo x2][ngày tạo x2][ngẫu nhiên x1] ----------------
--    Chữ số + chữ in hoa (0-9, A-Z), tổng 6 ký tự.
CREATE OR REPLACE FUNCTION public._b36(n bigint, len int) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  out text := '';
  v bigint := abs(n);
BEGIN
  FOR i IN 1..len LOOP
    out := substr(digits, (v % 36)::int + 1, 1) || out;
    v := v / 36;
  END LOOP;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.subject_abbr(p_subject text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_subject
    WHEN 'Toán' THEN 'T'
    WHEN 'Vật lí' THEN 'L'
    WHEN 'Hóa học' THEN 'H'
    WHEN 'Sinh học' THEN 'S'
    WHEN 'Địa lí' THEN 'D'
    WHEN 'Lịch sử' THEN 'U'
    WHEN 'GDKT & Pháp luật' THEN 'P'
    WHEN 'Tin học' THEN 'I'
    WHEN 'Công nghệ' THEN 'N'
    WHEN 'Ngoại ngữ' THEN 'A'
    ELSE 'X'
  END
$$;

CREATE OR REPLACE FUNCTION public.gen_exam_short_id(p_subject text, p_author uuid) RETURNS text
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  prefix text;
  who text;
  day text;
  candidate text;
  tries int := 0;
BEGIN
  prefix := public.subject_abbr(p_subject);
  who := public._b36(('x' || substr(md5(COALESCE(p_author::text, 'anon')), 1, 7))::bit(28)::bigint % 1296, 2);
  day := public._b36(GREATEST(0, floor(extract(epoch FROM (now() - timestamptz '2026-01-01')) / 86400))::bigint % 1296, 2);
  LOOP
    candidate := prefix || who || day || public._b36(floor(random() * 36)::bigint, 1);
    tries := tries + 1;
    IF tries > 30 THEN
      -- quá nhiều đề cùng môn/người/ngày: đổi cả ký tự ngày cho tới khi hết trùng
      candidate := prefix || who || public._b36(floor(random() * 1296)::bigint, 2) || public._b36(floor(random() * 36)::bigint, 1);
    END IF;
    IF tries > 500 THEN RAISE EXCEPTION 'Không tạo được mã đề duy nhất'; END IF;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.exams WHERE short_id = candidate);
  END LOOP;
  RETURN candidate;
END $$;

-- 3. Trigger tạo đề: tác giả, mã đề, kiểm tra giới hạn ---------------------
CREATE OR REPLACE FUNCTION public.exams_set_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sec jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    NEW.created_by := auth.uid();
    NEW.short_id := public.gen_exam_short_id(NEW.subject, NEW.author_id);  -- không tin mã từ client
  END IF;
  IF jsonb_typeof(NEW.config -> 'sections') = 'array' THEN
    FOR sec IN SELECT * FROM jsonb_array_elements(NEW.config -> 'sections') LOOP
      IF COALESCE((sec ->> 'question_count')::int, 0) > 100 THEN
        RAISE EXCEPTION 'Mỗi phần tối đa 100 câu';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_exams_set_author ON public.exams;
CREATE TRIGGER trg_exams_set_author BEFORE INSERT OR UPDATE OF config ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.exams_set_author();

-- Cấp mã mới (đúng quy tắc) cho đề cũ có mã 8 ký tự hoặc chưa có mã
UPDATE public.exams
SET short_id = public.gen_exam_short_id(subject, COALESCE(author_id, created_by))
WHERE short_id IS NULL OR short_id !~ '^[0-9A-Z]{6}$';

-- Chống đổi mã đề / tác giả khi UPDATE thường
CREATE OR REPLACE FUNCTION public.exams_lock_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.short_id := OLD.short_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exams_lock_identity ON public.exams;
CREATE TRIGGER trg_exams_lock_identity BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.exams_lock_identity();

-- 4. Đáp án: tối đa 100 câu mỗi phần --------------------------------------
CREATE OR REPLACE FUNCTION public.exam_keys_limit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM jsonb_object_keys(COALESCE(NEW.part_1_keys, '{}'::jsonb))) > 100
     OR (SELECT count(*) FROM jsonb_object_keys(COALESCE(NEW.part_2_keys, '{}'::jsonb))) > 100
     OR (SELECT count(*) FROM jsonb_object_keys(COALESCE(NEW.part_3_keys, '{}'::jsonb))) > 100 THEN
    RAISE EXCEPTION 'Mỗi phần tối đa 100 câu';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exam_keys_limit ON public.exam_answer_keys;
CREATE TRIGGER trg_exam_keys_limit BEFORE INSERT OR UPDATE ON public.exam_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.exam_keys_limit();
