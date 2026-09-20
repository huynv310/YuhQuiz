-- 1) Học sinh xem lời giải (văn bản + tệp) sau khi nộp bài.
CREATE OR REPLACE FUNCTION public.get_answer_keys_after_submit(p_exam_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.owns_exam(p_exam_id) OR EXISTS (
      SELECT 1 FROM submissions WHERE exam_id = p_exam_id AND student_id = auth.uid() AND status = 'submitted')) THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT jsonb_build_object('part_1', part_1_keys, 'part_2', part_2_keys, 'part_3', part_3_keys,
                                    'solutions', COALESCE(solutions, '{}'::jsonb))
          FROM exam_answer_keys WHERE exam_id = p_exam_id);
END $$;

-- 2) Luyện tập tự do: câu hỏi trong kho của giáo viên (chỉ câu giáo viên cho phép).
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS practice_enabled BOOLEAN NOT NULL DEFAULT true;

-- Danh sách câu hỏi: KHÔNG trả đáp án / lời giải.
CREATE OR REPLACE FUNCTION public.practice_list(
  p_subject text DEFAULT NULL, p_grade int DEFAULT NULL, p_tag text DEFAULT NULL,
  p_part int DEFAULT NULL, p_limit int DEFAULT 10)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM (
    SELECT id, subject, grade, topic_tags, part, difficulty, content_image_url
    FROM question_bank
    WHERE auth.uid() IS NOT NULL AND practice_enabled
      AND (p_subject IS NULL OR subject = p_subject)
      AND (p_grade   IS NULL OR grade = p_grade)
      AND (p_part    IS NULL OR part = p_part)
      AND (p_tag IS NULL OR p_tag = ANY(topic_tags))
    ORDER BY random()
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 30)
  ) t;
$$;

-- Các #tag đang có (để lọc)
CREATE OR REPLACE FUNCTION public.practice_tags(p_subject text DEFAULT NULL, p_grade int DEFAULT NULL)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT tg ORDER BY tg), '{}') FROM (
    SELECT unnest(topic_tags) tg FROM question_bank
    WHERE auth.uid() IS NOT NULL AND practice_enabled
      AND (p_subject IS NULL OR subject = p_subject) AND (p_grade IS NULL OR grade = p_grade)
    LIMIT 2000) x;
$$;

-- Đáp án + lời giải: chỉ trả cho các câu được yêu cầu (bấm "Kiểm tra").
CREATE OR REPLACE FUNCTION public.practice_check(p_ids uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', id, 'part', part, 'correct_key', correct_key,
           'solution_text', solution_text, 'solution_files', solution_files)), '[]'::jsonb)
  FROM question_bank
  WHERE auth.uid() IS NOT NULL AND practice_enabled
    AND id = ANY(p_ids[1:30]);
$$;

REVOKE ALL ON FUNCTION public.practice_list(text,int,text,int,int), public.practice_tags(text,int), public.practice_check(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_list(text,int,text,int,int), public.practice_tags(text,int), public.practice_check(uuid[]) TO authenticated;
