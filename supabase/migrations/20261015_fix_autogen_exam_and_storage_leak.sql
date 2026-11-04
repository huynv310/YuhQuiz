-- ====================================================================
-- YUHQUIZ MIGRATION: 20261015_fix_autogen_exam_and_storage_leak.sql
-- 1. Cho phép exams.pdf_url có thể null nếu đề thi tạo từ kho câu hỏi (có config.question_images).
-- 2. Chuẩn hóa kiểu dữ liệu điểm số trong bảng submissions thành NUMERIC(5,2) để hỗ trợ thang điểm 100 / điểm thô.
-- 3. Sửa lỗi Regex trong extract_storage_paths và release_storage_paths để nhận diện đúng hash 24 chars (frontend sinh ra).
-- 4. Tạo hàm RPC nguyên tử create_exam_from_bank() đảm bảo toàn vẹn giao dịch (ACID).
-- ====================================================================

-- 1. Cho phép pdf_url nullable (Khắc phục lỗi: null value in column "pdf_url" violates not-null constraint)
ALTER TABLE public.exams ALTER COLUMN pdf_url DROP NOT NULL;

-- 2. Chuẩn hóa kiểu dữ liệu điểm số trong submissions
-- Tạm drop view và trigger phụ thuộc trước khi alter type
DROP TRIGGER IF EXISTS trg_submissions_stats_upd ON public.submissions;
DROP VIEW IF EXISTS public.public_leaderboard;

ALTER TABLE public.submissions 
  ALTER COLUMN score_part_1 TYPE NUMERIC(5,2),
  ALTER COLUMN score_part_2 TYPE NUMERIC(5,2),
  ALTER COLUMN score_part_3 TYPE NUMERIC(5,2),
  ALTER COLUMN total_score TYPE NUMERIC(5,2);

CREATE VIEW public.public_leaderboard AS
  SELECT id, exam_id, student_id, student_name, class_name, school, score, total_score,
         cheat_count, total_away_seconds, status, started_at, submitted_at
  FROM public.submissions
  WHERE status = 'submitted';

REVOKE ALL ON public.public_leaderboard FROM anon, public;
GRANT SELECT ON public.public_leaderboard TO authenticated;

-- Khôi phục trigger thống kê bảng xếp hạng
CREATE TRIGGER trg_submissions_stats_upd AFTER UPDATE OF status, total_score ON public.submissions
  FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public.trg_submissions_stats();

-- 3. Sửa hàm gom và giải phóng đường dẫn tệp trong Storage (Hỗ trợ hash 24..64 ký tự hex)
CREATE OR REPLACE FUNCTION public.extract_storage_paths(t text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT m[1]), '{}')
  FROM regexp_matches(COALESCE(t, ''), '([0-9a-f-]{36}/(?:sol/)?[0-9a-f]{24,64}\.(?:webp|png|jpg|jpeg|pdf))', 'g') AS m;
$$;

CREATE OR REPLACE FUNCTION public.release_storage_paths(p_paths text[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p text;
BEGIN
  FOREACH p IN ARRAY COALESCE(p_paths, '{}') LOOP
    CONTINUE WHEN p IS NULL OR p !~ '^[0-9a-f-]{36}/(sol/)?[0-9a-f]{24,64}\.(webp|png|jpg|jpeg|pdf)$';
    IF NOT public.storage_path_in_use(p) THEN
      DELETE FROM storage.objects WHERE bucket_id = 'question-images' AND name = p;
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.extract_storage_paths(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_storage_paths(text[]) FROM PUBLIC, anon, authenticated;

-- 4. RPC Tạo đề ngẫu nhiên nguyên tử từ Ngân hàng câu hỏi (Atomic Transaction)
CREATE OR REPLACE FUNCTION public.create_exam_from_bank(
  p_title text,
  p_subject text,
  p_grade int,
  p_duration_minutes int,
  p_pdf_url text,
  p_config jsonb,
  p_answer_keys jsonb,
  p_solutions jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author_id uuid := auth.uid();
  v_teacher_name text;
  v_exam_id uuid;
  v_short_id text;
BEGIN
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'Yêu cầu đăng nhập';
  END IF;
  IF NOT public.is_teacher() THEN
    RAISE EXCEPTION 'Chỉ giáo viên mới có quyền tạo đề';
  END IF;
  IF p_grade < 1 OR p_grade > 12 THEN
    RAISE EXCEPTION 'Khối lớp không hợp lệ (1-12)';
  END IF;

  SELECT full_name INTO v_teacher_name FROM public.profiles WHERE id = v_author_id;

  INSERT INTO public.exams (
    title, subject, grade, duration_minutes, pdf_url, config, teacher_name, author_id, created_by, is_private
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_title), ''), 'Đề ngẫu nhiên'),
    COALESCE(NULLIF(TRIM(p_subject), ''), 'Toán'),
    p_grade,
    GREATEST(1, p_duration_minutes),
    p_pdf_url,
    p_config,
    COALESCE(v_teacher_name, ''),
    v_author_id,
    v_author_id,
    false
  ) RETURNING id, short_id INTO v_exam_id, v_short_id;

  INSERT INTO public.exam_answer_keys (
    exam_id, part_1_keys, part_2_keys, part_3_keys, solutions, updated_at
  ) VALUES (
    v_exam_id,
    COALESCE(p_answer_keys->'part_1_keys', '{}'::jsonb),
    COALESCE(p_answer_keys->'part_2_keys', '{}'::jsonb),
    COALESCE(p_answer_keys->'part_3_keys', '{}'::jsonb),
    COALESCE(p_solutions, '{}'::jsonb),
    now()
  );

  RETURN jsonb_build_object(
    'id', v_exam_id,
    'short_id', v_short_id
  );
END $$;

REVOKE ALL ON FUNCTION public.create_exam_from_bank(text,text,int,int,text,jsonb,jsonb,jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_exam_from_bank(text,text,int,int,text,jsonb,jsonb,jsonb) TO authenticated;
