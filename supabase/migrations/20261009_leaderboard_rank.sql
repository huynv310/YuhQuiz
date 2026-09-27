-- Bảng xếp hạng toàn hệ thống: 2 bảng RIÊNG cho giáo viên (đóng góp) và học sinh (thành tích),
-- không trộn lẫn vai trò. Chỉ tính đề thi CHÍNH THỨC (submissions.status='submitted'), không
-- tính luyện tập tự do.
--
-- Thiết kế cho "ít tốn bộ nhớ nhất": không tính lại toàn bảng mỗi lần xem — dùng 2 bảng tổng
-- hợp (1 dòng/người), cập nhật bằng trigger mỗi khi có bài nộp/đề mới, và đọc Top-N bằng index
-- B-tree (O(log n)), không cần cấu trúc heap/priority-queue phía ứng dụng.
--
-- Vì regrade (teacher_regrade) và làm lại nhiều lượt (allow_multiple_attempts) đều có thể đổi
-- điểm sau khi đã nộp, ta KHÔNG cộng dồn tăng dần (dễ lệch dữ liệu nếu có bug) mà tính lại đúng
-- 1 người bị ảnh hưởng mỗi lần — độ phức tạp giới hạn bởi số đề của riêng người đó, không phải
-- toàn hệ thống.

-- 1. BẢNG TỔNG HỢP -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_stats (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  exams_completed INT NOT NULL DEFAULT 0,
  avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  rank_score NUMERIC(6,3) NOT NULL DEFAULT 0,
  rank_tier TEXT NOT NULL DEFAULT 'Tân Binh',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_stats_rank ON public.student_stats (rank_score DESC);

CREATE TABLE IF NOT EXISTS public.teacher_stats (
  teacher_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  exams_count INT NOT NULL DEFAULT 0,
  rank_tier TEXT NOT NULL DEFAULT 'Hạt Giống',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_teacher_stats_rank ON public.teacher_stats (exams_count DESC);

ALTER TABLE public.student_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_stats ENABLE ROW LEVEL SECURITY;
-- Không cấp policy trực tiếp: chỉ đọc qua RPC SECURITY DEFINER ở dưới (kiểm soát đúng cột trả về).
REVOKE ALL ON public.student_stats, public.teacher_stats FROM public, anon, authenticated;

-- 2. BẬC XẾP HẠNG (ngưỡng tạm, có thể chỉnh sau khi có dữ liệu thật) ----
CREATE OR REPLACE FUNCTION public.student_rank_tier(p_score numeric) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_score >= 7.0 THEN 'Huyền Thoại'
    WHEN p_score >= 5.5 THEN 'Thủ Khoa'
    WHEN p_score >= 4.0 THEN 'Tinh Anh'
    WHEN p_score >= 2.5 THEN 'Xuất Sắc'
    WHEN p_score >= 1.0 THEN 'Chăm Chỉ'
    ELSE 'Tân Binh'
  END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_rank_tier(p_count int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_count >= 80 THEN 'Huyền Thoại'
    WHEN p_count >= 30 THEN 'Ngôi Sao Đóng Góp'
    WHEN p_count >= 10 THEN 'Đóng Góp Tích Cực'
    WHEN p_count >= 3  THEN 'Cộng Tác Viên'
    ELSE 'Hạt Giống'
  END;
$$;

-- 3. TÍNH LẠI CHO 1 NGƯỜI (không quét toàn hệ thống) --------------------
CREATE OR REPLACE FUNCTION public.recompute_student_stats(p_student_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_avg numeric; v_rank numeric;
BEGIN
  IF p_student_id IS NULL THEN RETURN; END IF;
  -- Điểm cao nhất trong các lượt làm CÙNG 1 đề (đề cho phép làm lại) được tính là điểm của đề đó
  SELECT count(*), COALESCE(avg(best_score), 0) INTO v_count, v_avg
  FROM (
    SELECT exam_id, max(total_score) AS best_score
    FROM public.submissions
    WHERE student_id = p_student_id AND status = 'submitted'
    GROUP BY exam_id
  ) t;
  -- Trung bình có độ tin cậy theo số lượng (ưu tiên số đề đã làm hơn điểm số đơn lẻ):
  -- rank_score tiến gần avg_score khi làm nhiều đề, bị "giảm giá" mạnh khi làm ít đề.
  v_rank := ROUND(v_avg * v_count / (v_count + 20.0), 3);
  INSERT INTO public.student_stats (student_id, exams_completed, avg_score, rank_score, rank_tier, updated_at)
  VALUES (p_student_id, v_count, v_avg, v_rank, public.student_rank_tier(v_rank), now())
  ON CONFLICT (student_id) DO UPDATE SET
    exams_completed = v_count, avg_score = v_avg, rank_score = v_rank,
    rank_tier = public.student_rank_tier(v_rank), updated_at = now();
END $$;

CREATE OR REPLACE FUNCTION public.recompute_teacher_stats(p_teacher_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF p_teacher_id IS NULL THEN RETURN; END IF;
  -- Chỉ tính đề còn hoạt động VÀ đã có học sinh nộp bài thật (chặn spam tạo đề rác để leo hạng).
  SELECT count(*) INTO v_count
  FROM public.exams e
  WHERE e.created_by = p_teacher_id AND e.is_active = true
    AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.exam_id = e.id AND s.status = 'submitted');
  INSERT INTO public.teacher_stats (teacher_id, exams_count, rank_tier, updated_at)
  VALUES (p_teacher_id, v_count, public.teacher_rank_tier(v_count), now())
  ON CONFLICT (teacher_id) DO UPDATE SET
    exams_count = v_count, rank_tier = public.teacher_rank_tier(v_count), updated_at = now();
END $$;

-- 4. TRIGGER: cập nhật đúng người bị ảnh hưởng khi có bài nộp/regrade/xóa đề ---
CREATE OR REPLACE FUNCTION public.trg_submissions_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_teacher uuid;
BEGIN
  IF NEW.status = 'submitted' THEN
    PERFORM public.recompute_student_stats(NEW.student_id);
    SELECT created_by INTO v_teacher FROM public.exams WHERE id = NEW.exam_id;
    PERFORM public.recompute_teacher_stats(v_teacher);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_submissions_stats_ins ON public.submissions;
CREATE TRIGGER trg_submissions_stats_ins AFTER INSERT ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_submissions_stats();
DROP TRIGGER IF EXISTS trg_submissions_stats_upd ON public.submissions;
CREATE TRIGGER trg_submissions_stats_upd AFTER UPDATE OF status, total_score ON public.submissions
  FOR EACH ROW WHEN (NEW.status = 'submitted') EXECUTE FUNCTION public.trg_submissions_stats();

CREATE OR REPLACE FUNCTION public.trg_exams_stats() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_teacher_stats(COALESCE(NEW.created_by, OLD.created_by));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_exams_stats_upd ON public.exams;
CREATE TRIGGER trg_exams_stats_upd AFTER UPDATE OF is_active ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.trg_exams_stats();

-- 5. RPC CÔNG KHAI: chỉ trả username + trường học + số liệu hạng, KHÔNG có SĐT/email --
CREATE OR REPLACE FUNCTION public.get_student_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (full_name text, school text, exams_completed int, avg_score numeric, rank_score numeric, rank_tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.school, s.exams_completed, s.avg_score, s.rank_score, s.rank_tier
  FROM public.student_stats s
  JOIN public.profiles p ON p.id = s.student_id
  WHERE s.exams_completed > 0
  ORDER BY s.rank_score DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

CREATE OR REPLACE FUNCTION public.get_teacher_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (full_name text, school text, exams_count int, rank_tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.full_name, p.school, t.exams_count, t.rank_tier
  FROM public.teacher_stats t
  JOIN public.profiles p ON p.id = t.teacher_id
  WHERE t.exams_count > 0
  ORDER BY t.exams_count DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
$$;

-- Hạng + vị trí của CHÍNH người gọi (không lộ toàn bảng để tự tính vị trí).
CREATE OR REPLACE FUNCTION public.get_my_rank() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_role text; v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;

  IF v_role = 'teacher' THEN
    SELECT jsonb_build_object(
      'role', 'teacher', 'exams_count', t.exams_count, 'rank_tier', t.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.teacher_stats WHERE exams_count > t.exams_count)
    ) INTO v_result
    FROM public.teacher_stats t WHERE t.teacher_id = v_uid;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'teacher', 'exams_count', 0, 'rank_tier', public.teacher_rank_tier(0), 'position', NULL));
  ELSE
    SELECT jsonb_build_object(
      'role', 'student', 'exams_completed', s.exams_completed, 'avg_score', s.avg_score,
      'rank_score', s.rank_score, 'rank_tier', s.rank_tier,
      'position', (SELECT count(*) + 1 FROM public.student_stats WHERE rank_score > s.rank_score)
    ) INTO v_result
    FROM public.student_stats s WHERE s.student_id = v_uid;

    RETURN COALESCE(v_result, jsonb_build_object(
      'role', 'student', 'exams_completed', 0, 'avg_score', 0,
      'rank_score', 0, 'rank_tier', public.student_rank_tier(0), 'position', NULL));
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_student_leaderboard(int),
                       public.get_teacher_leaderboard(int),
                       public.get_my_rank() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_student_leaderboard(int),
                          public.get_teacher_leaderboard(int),
                          public.get_my_rank() TO authenticated;

-- 6. BACKFILL: tính hạng cho dữ liệu đã có sẵn trước khi tính năng này ra đời -----
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
