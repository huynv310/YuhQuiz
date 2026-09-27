-- Reset bảng xếp hạng theo năm học (mặc định mốc 5/9 hàng năm), KHÔNG xóa dữ liệu và KHÔNG
-- cần cron job: gắn "season_tag" (VD '2026-2027') cho mỗi dòng thống kê tại thời điểm tính, các
-- RPC đọc BXH chỉ lấy đúng season hiện tại — dữ liệu mùa trước tự động "biến mất" khỏi bảng xếp
-- hạng ngay khi qua mốc reset (không cần job chạy đúng lúc 0h ngày 5/9), nhưng vẫn còn nguyên
-- trong DB nếu sau này cần xem lại lịch sử mùa cũ.

-- 1. MỐC NĂM HỌC ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.academic_year_start(p_at timestamptz DEFAULT now()) RETURNS timestamptz
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_at AT TIME ZONE 'Asia/Ho_Chi_Minh' >= make_timestamp(extract(year from p_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int, 9, 5, 0, 0, 0)
      THEN make_timestamptz(extract(year from p_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int, 9, 5, 0, 0, 0, 'Asia/Ho_Chi_Minh')
    ELSE make_timestamptz(extract(year from p_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::int - 1, 9, 5, 0, 0, 0, 'Asia/Ho_Chi_Minh')
  END;
$$;

CREATE OR REPLACE FUNCTION public.academic_year_tag(p_at timestamptz DEFAULT now()) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT extract(year from public.academic_year_start(p_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::text
      || '-' || (extract(year from public.academic_year_start(p_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::int + 1)::text;
$$;

-- 2. THÊM CỘT SEASON ------------------------------------------------------
ALTER TABLE public.student_stats ADD COLUMN IF NOT EXISTS season_tag text NOT NULL DEFAULT public.academic_year_tag();
ALTER TABLE public.teacher_stats ADD COLUMN IF NOT EXISTS season_tag text NOT NULL DEFAULT public.academic_year_tag();

DROP INDEX IF EXISTS public.idx_student_stats_rank;
CREATE INDEX IF NOT EXISTS idx_student_stats_season_rank ON public.student_stats (season_tag, rank_score DESC);
DROP INDEX IF EXISTS public.idx_teacher_stats_rank;
CREATE INDEX IF NOT EXISTS idx_teacher_stats_season_rank ON public.teacher_stats (season_tag, exams_count DESC);

-- 3. TÍNH LẠI: CHỈ TÍNH TRONG PHẠM VI NĂM HỌC HIỆN TẠI --------------------
CREATE OR REPLACE FUNCTION public.recompute_student_stats(p_student_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_avg numeric; v_rank numeric; v_season text := public.academic_year_tag();
BEGIN
  IF p_student_id IS NULL THEN RETURN; END IF;
  SELECT count(*), COALESCE(avg(best_score), 0) INTO v_count, v_avg
  FROM (
    SELECT exam_id, max(total_score) AS best_score
    FROM public.submissions
    WHERE student_id = p_student_id AND status = 'submitted'
      AND submitted_at >= public.academic_year_start()
    GROUP BY exam_id
  ) t;
  v_rank := ROUND(v_avg * v_count / (v_count + 20.0), 3);
  INSERT INTO public.student_stats (student_id, exams_completed, avg_score, rank_score, rank_tier, season_tag, updated_at)
  VALUES (p_student_id, v_count, v_avg, v_rank, public.student_rank_tier(v_rank), v_season, now())
  ON CONFLICT (student_id) DO UPDATE SET
    exams_completed = v_count, avg_score = v_avg, rank_score = v_rank,
    rank_tier = public.student_rank_tier(v_rank), season_tag = v_season, updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_teacher_stats(p_teacher_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_season text := public.academic_year_tag();
BEGIN
  IF p_teacher_id IS NULL THEN RETURN; END IF;
  -- Đề vẫn tính nếu đang hoạt động VÀ có bài nộp thật TRONG năm học hiện tại (đề cũ vẫn tính nếu
  -- năm nay tiếp tục có học sinh làm — hợp lý vì đó vẫn là đóng góp đang phát huy tác dụng).
  SELECT count(*) INTO v_count
  FROM public.exams e
  WHERE e.created_by = p_teacher_id AND e.is_active = true
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.exam_id = e.id AND s.status = 'submitted' AND s.submitted_at >= public.academic_year_start()
    );
  INSERT INTO public.teacher_stats (teacher_id, exams_count, rank_tier, season_tag, updated_at)
  VALUES (p_teacher_id, v_count, public.teacher_rank_tier(v_count), v_season, now())
  ON CONFLICT (teacher_id) DO UPDATE SET
    exams_count = v_count, rank_tier = public.teacher_rank_tier(v_count), season_tag = v_season, updated_at = now();
END $$;

-- 4. RPC: CHỈ ĐỌC ĐÚNG MÙA HIỆN TẠI (dữ liệu mùa cũ coi như đã "reset") ---
CREATE OR REPLACE FUNCTION public.get_student_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (full_name text, school text, exams_completed int, avg_score numeric, rank_score numeric, rank_tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.school, s.exams_completed, s.avg_score, s.rank_score, s.rank_tier
  FROM public.student_stats s
  JOIN public.profiles p ON p.id = s.student_id
  WHERE s.exams_completed > 0 AND s.season_tag = public.academic_year_tag()
  ORDER BY s.rank_score DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (full_name text, school text, exams_count int, rank_tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.school, t.exams_count, t.rank_tier
  FROM public.teacher_stats t
  JOIN public.profiles p ON p.id = t.teacher_id
  WHERE t.exams_count > 0 AND t.season_tag = public.academic_year_tag()
  ORDER BY t.exams_count DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.get_my_rank() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_result jsonb; v_season text := public.academic_year_tag();
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_role = 'teacher' THEN
    SELECT jsonb_build_object(
      'role', 'teacher', 'exams_count', t.exams_count, 'rank_tier', t.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.teacher_stats WHERE season_tag = v_season AND exams_count > t.exams_count)
    ) INTO v_result
    FROM public.teacher_stats t WHERE t.teacher_id = v_uid AND t.season_tag = v_season;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'teacher', 'exams_count', 0, 'rank_tier', public.teacher_rank_tier(0), 'position', NULL));
  ELSE
    SELECT jsonb_build_object(
      'role', 'student', 'exams_completed', s.exams_completed, 'avg_score', s.avg_score,
      'rank_score', s.rank_score, 'rank_tier', s.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.student_stats WHERE season_tag = v_season AND rank_score > s.rank_score)
    ) INTO v_result
    FROM public.student_stats s WHERE s.student_id = v_uid AND s.season_tag = v_season;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'student', 'exams_completed', 0, 'avg_score', 0,
      'rank_score', 0, 'rank_tier', public.student_rank_tier(0), 'position', NULL));
  END IF;
END $$;

-- 5. TÍNH LẠI TOÀN BỘ theo phạm vi mùa hiện tại (áp dụng ngay cho dữ liệu đã tính từ trước) --
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT student_id FROM public.submissions WHERE status = 'submitted' AND student_id IS NOT NULL LOOP
    PERFORM public.recompute_student_stats(r.student_id);
  END LOOP;
  FOR r IN SELECT DISTINCT created_by FROM public.exams WHERE created_by IS NOT NULL LOOP
    PERFORM public.recompute_teacher_stats(r.created_by);
  END LOOP;
END $$;
