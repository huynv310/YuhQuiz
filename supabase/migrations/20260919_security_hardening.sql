-- ====================================================================
-- YUHQUIZ - MIGRATION BẢO MẬT (RLS + RPC + STORAGE)
-- Chạy trong Supabase SQL Editor (DB mới: sau schema.sql; DB cũ: chạy thẳng được). Có thể chạy lại (idempotent).
-- Cần: chạy `git diff`/backup DB trước khi áp dụng trên dữ liệu thật.
-- ====================================================================

-- -1. TƯƠNG THÍCH DB CŨ (sinh từ schema.sql) -------------------------
-- DB tạo từ phiên bản cũ có thể thiếu bảng/cột (vd exams.author_id). CREATE TABLE IF NOT EXISTS
-- trong schema.sql bỏ qua bảng đã tồn tại nên không bổ sung cột; phần này bù lại. Idempotent.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'student', -- Giữ VARCHAR để tương thích ngược, chuẩn bị sang user_role
    full_name TEXT NOT NULL,
    phone TEXT UNIQUE,
    email TEXT UNIQUE,
    school TEXT,
    grade INT DEFAULT 12,
    avatar_url TEXT,
    student_code TEXT,
    user_code TEXT UNIQUE, -- Tương thích ngược
    dob DATE,              -- Tương thích ngược
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'student';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS grade INT DEFAULT 12;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_code TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.classrooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Toán',
    school TEXT,
    grade INT DEFAULT 12,
    class_code VARCHAR(8) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Toán';
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS grade INT DEFAULT 12;
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS class_code VARCHAR(8);
ALTER TABLE public.classrooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,     -- Tương thích ngược
    student_phone TEXT,    -- Tương thích ngược
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS student_phone TEXT;
ALTER TABLE public.class_memberships ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    short_id VARCHAR(10) UNIQUE,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Tương thích ngược
    title TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT 'Toán',
    grade INT NOT NULL DEFAULT 12,
    duration_minutes INT NOT NULL DEFAULT 50,
    pdf_r2_url TEXT,
    pdf_url TEXT, -- Tương thích ngược
    status VARCHAR(20) DEFAULT 'published',
    allow_multiple_attempts BOOLEAN NOT NULL DEFAULT true,
    grading_config JSONB DEFAULT '{}',
    config JSONB DEFAULT '{}', -- Tương thích ngược
    answer_keys JSONB DEFAULT '{}', -- Tương thích ngược
    teacher_name TEXT, -- Tương thích ngược
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_private BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS short_id VARCHAR(10);
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Toán';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS grade INT NOT NULL DEFAULT 12;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS duration_minutes INT NOT NULL DEFAULT 50;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pdf_r2_url TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS allow_multiple_attempts BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS grading_config JSONB DEFAULT '{}';
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
-- (exams.answer_keys là cột cũ, cố ý KHÔNG tạo lại: bước 0 chuyển nó sang exam_answer_keys rồi xóa)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS teacher_name TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.exam_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_id, class_id)
);
ALTER TABLE public.exam_assignments ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE public.exam_assignments ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classrooms(id) ON DELETE CASCADE;
ALTER TABLE public.exam_assignments ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;
ALTER TABLE public.exam_assignments ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;
ALTER TABLE public.exam_assignments ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.profiles(id),
    chapter_name TEXT NOT NULL, 
    topic_tags TEXT[] DEFAULT '{}', 
    difficulty INT NOT NULL CHECK (difficulty BETWEEN 1 AND 4),
    content_image_url TEXT NOT NULL,
    correct_key TEXT NOT NULL,
    solution_text TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS chapter_name TEXT;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS topic_tags TEXT[] DEFAULT '{}';
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS difficulty INT CHECK (difficulty BETWEEN 1 AND 4);
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS content_image_url TEXT;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS correct_key TEXT;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS solution_text TEXT;
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.exam_answer_keys (
    exam_id UUID PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
    part_1_keys JSONB DEFAULT '{}',
    part_2_keys JSONB DEFAULT '{}',
    part_3_keys JSONB DEFAULT '{}',
    question_snippets JSONB DEFAULT '{}',
    solutions JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS part_1_keys JSONB DEFAULT '{}';
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS part_2_keys JSONB DEFAULT '{}';
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS part_3_keys JSONB DEFAULT '{}';
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS question_snippets JSONB DEFAULT '{}';
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS solutions JSONB DEFAULT '{}';
ALTER TABLE public.exam_answer_keys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL,
    student_name TEXT NOT NULL,
    class_name TEXT,
    school TEXT,
    session_token UUID NOT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    status VARCHAR(20) DEFAULT 'in_progress',
    score_part_1 NUMERIC(4,2) DEFAULT 0.00,
    score_part_2 NUMERIC(4,2) DEFAULT 0.00,
    score_part_3 NUMERIC(4,2) DEFAULT 0.00,
    total_score NUMERIC(4,2) DEFAULT 0.00,
    student_answers JSONB DEFAULT '{}',
    telemetry_logs JSONB DEFAULT '[]',
    answers JSONB DEFAULT '{}',       -- Tương thích ngược
    score NUMERIC(5, 2) DEFAULT NULL, -- Tương thích ngược
    score_details JSONB DEFAULT '{}', -- Tương thích ngược
    cheat_count INT DEFAULT 0,        -- Tương thích ngược
    total_away_seconds INT DEFAULT 0, -- Tương thích ngược
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (exam_id, session_token)
);
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classrooms(id) ON DELETE SET NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS class_name TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS school TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS session_token UUID;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS attempt_number INT NOT NULL DEFAULT 1;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'in_progress';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score_part_1 NUMERIC(4,2) DEFAULT 0.00;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score_part_2 NUMERIC(4,2) DEFAULT 0.00;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score_part_3 NUMERIC(4,2) DEFAULT 0.00;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS total_score NUMERIC(4,2) DEFAULT 0.00;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS student_answers JSONB DEFAULT '{}';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS telemetry_logs JSONB DEFAULT '[]';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) DEFAULT NULL;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS score_details JSONB DEFAULT '{}';
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS cheat_count INT DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS total_away_seconds INT DEFAULT 0;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.student_mistakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    part_type TEXT NOT NULL,
    question_number INT NOT NULL,
    question_image_url TEXT,
    wrong_answer TEXT,
    correct_answer TEXT NOT NULL,
    solution_text TEXT,
    repetition_level INT DEFAULT 0,
    interval_days INT DEFAULT 1,
    next_review_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day',
    is_mastered BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, exam_id, part_type, question_number)
);
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS part_type TEXT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS question_number INT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS question_image_url TEXT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS wrong_answer TEXT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS correct_answer TEXT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS solution_text TEXT;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS repetition_level INT DEFAULT 0;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS interval_days INT DEFAULT 1;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 day';
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS is_mastered BOOLEAN DEFAULT false;
ALTER TABLE public.student_mistakes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ràng buộc duy nhất mà ON CONFLICT trong các RPC cần (nếu dữ liệu cũ có trùng, lệnh này báo lỗi rõ ràng)
CREATE UNIQUE INDEX IF NOT EXISTS uq_class_memberships_class_id_student_id ON public.class_memberships(class_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_exam_assignments_exam_id_class_id ON public.exam_assignments(exam_id, class_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_submissions_exam_id_session_token ON public.submissions(exam_id, session_token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_mistakes_student_id_exam_id_part_type_question_number ON public.student_mistakes(student_id, exam_id, part_type, question_number);

-- 0. BACKFILL & CHUYỂN ĐÁP ÁN RA BẢNG RIÊNG -------------------------
UPDATE public.exams SET author_id = created_by WHERE author_id IS NULL AND created_by IS NOT NULL;
UPDATE public.exams SET created_by = author_id WHERE created_by IS NULL AND author_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='exams' AND column_name='answer_keys') THEN
    INSERT INTO public.exam_answer_keys (exam_id, part_1_keys, part_2_keys, part_3_keys)
    SELECT id,
           COALESCE(answer_keys->'part_1', '{}'::jsonb),
           COALESCE(answer_keys->'part_2', '{}'::jsonb),
           COALESCE(answer_keys->'part_3', '{}'::jsonb)
    FROM public.exams
    WHERE answer_keys IS NOT NULL
    ON CONFLICT (exam_id) DO NOTHING;   -- không bao giờ ghi đè đáp án đã có ở bảng mới
    ALTER TABLE public.exams DROP COLUMN answer_keys;
  END IF;
END $$;

-- Kho bài tập: phân loại theo phần của đề THPTQG 2025 và ràng buộc định dạng đáp án
--   part 1: A|B|C|D    part 2: 4 ký tự T/F cho ý a,b,c,d (vd 'TFFT')    part 3: số (vd '-1.5')
ALTER TABLE public.question_bank ADD COLUMN IF NOT EXISTS part smallint NOT NULL DEFAULT 1;
ALTER TABLE public.question_bank DROP CONSTRAINT IF EXISTS question_bank_part_key_chk;
ALTER TABLE public.question_bank ADD CONSTRAINT question_bank_part_key_chk CHECK (
  (part = 1 AND correct_key ~ '^[ABCD]$') OR
  (part = 2 AND correct_key ~ '^[TF]{4}$') OR
  (part = 3 AND correct_key ~ '^-?[0-9]+([.,][0-9]+)?$' AND length(correct_key) <= 10));
CREATE INDEX IF NOT EXISTS idx_question_bank_part ON public.question_bank(part, chapter_name, difficulty);

-- Tối ưu index cho RLS
CREATE INDEX IF NOT EXISTS idx_class_memberships_class ON public.class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_exams_author ON public.exams(author_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam_student ON public.submissions(exam_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_mistakes_review ON public.student_mistakes(student_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_question_bank_filter ON public.question_bank(chapter_name, difficulty);

-- 1. HÀM TRỢ GIÚP (SECURITY DEFINER để tránh đệ quy RLS) ------------
CREATE OR REPLACE FUNCTION public.is_teacher() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher');
$$;

CREATE OR REPLACE FUNCTION public.owns_exam(p_exam uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM exams WHERE id = p_exam AND COALESCE(author_id, created_by) = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.owns_class(p_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM classrooms WHERE id = p_class AND teacher_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_class_member(p_class uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM class_memberships WHERE class_id = p_class AND student_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.teaches_student(p_student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships m JOIN classrooms c ON c.id = m.class_id
    WHERE m.student_id = p_student AND c.teacher_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_my_teacher(p_teacher uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships m JOIN classrooms c ON c.id = m.class_id
    WHERE m.student_id = auth.uid() AND c.teacher_id = p_teacher);
$$;

-- 2. GỠ TOÀN BỘ POLICY CŨ (kể cả policy tạo tay trên dashboard) -----
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename IN ('profiles','classrooms','class_memberships','exams','exam_assignments',
                               'submissions','question_bank','exam_answer_keys','student_mistakes')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answer_keys  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mistakes  ENABLE ROW LEVEL SECURITY;

-- 3. POLICY MỚI -------------------------------------------------------
-- profiles: chỉ xem hồ sơ của mình, học sinh trong lớp mình dạy, hoặc giáo viên của mình
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.teaches_student(id) OR public.is_my_teacher(id));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- classrooms
CREATE POLICY classrooms_select ON public.classrooms FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.is_class_member(id));
CREATE POLICY classrooms_insert ON public.classrooms FOR INSERT TO authenticated
  WITH CHECK (teacher_id = auth.uid() AND public.is_teacher());
CREATE POLICY classrooms_update ON public.classrooms FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY classrooms_delete ON public.classrooms FOR DELETE TO authenticated
  USING (teacher_id = auth.uid());

-- class_memberships
CREATE POLICY memberships_select ON public.class_memberships FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.owns_class(class_id));
CREATE POLICY memberships_insert ON public.class_memberships FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());
CREATE POLICY memberships_update ON public.class_memberships FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY memberships_delete ON public.class_memberships FOR DELETE TO authenticated
  USING (student_id = auth.uid() OR public.owns_class(class_id));

-- exams: bảng gốc CHỈ tác giả truy cập. Học sinh đọc qua view public_exams (không có đáp án)
CREATE POLICY exams_select ON public.exams FOR SELECT TO authenticated
  USING (COALESCE(author_id, created_by) = auth.uid());
CREATE POLICY exams_insert ON public.exams FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher());
CREATE POLICY exams_update ON public.exams FOR UPDATE TO authenticated
  USING (COALESCE(author_id, created_by) = auth.uid())
  WITH CHECK (COALESCE(author_id, created_by) = auth.uid());
CREATE POLICY exams_delete ON public.exams FOR DELETE TO authenticated
  USING (COALESCE(author_id, created_by) = auth.uid());

-- gán tác giả từ phiên đăng nhập, không tin client
CREATE OR REPLACE FUNCTION public.exams_set_author() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.author_id := auth.uid();
  NEW.created_by := auth.uid();
  IF NEW.short_id IS NULL THEN
    NEW.short_id := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_exams_set_author ON public.exams;
CREATE TRIGGER trg_exams_set_author BEFORE INSERT ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.exams_set_author();

-- exam_answer_keys: chỉ tác giả (học sinh nhận đáp án qua RPC sau khi nộp bài)
CREATE POLICY keys_all ON public.exam_answer_keys FOR ALL TO authenticated
  USING (public.owns_exam(exam_id)) WITH CHECK (public.owns_exam(exam_id));

-- exam_assignments
CREATE POLICY assignments_select ON public.exam_assignments FOR SELECT TO authenticated
  USING (public.owns_exam(exam_id) OR public.is_class_member(class_id));
CREATE POLICY assignments_insert ON public.exam_assignments FOR INSERT TO authenticated
  WITH CHECK (public.owns_exam(exam_id) AND public.owns_class(class_id));
CREATE POLICY assignments_update ON public.exam_assignments FOR UPDATE TO authenticated
  USING (public.owns_exam(exam_id)) WITH CHECK (public.owns_exam(exam_id) AND public.owns_class(class_id));
CREATE POLICY assignments_delete ON public.exam_assignments FOR DELETE TO authenticated
  USING (public.owns_exam(exam_id) OR public.owns_class(class_id));

-- submissions: KHÔNG có policy INSERT/UPDATE/DELETE cho client. Ghi qua RPC.
CREATE POLICY submissions_select ON public.submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.owns_exam(exam_id) OR public.teaches_student(student_id));

-- question_bank: giáo viên đọc chung, chỉ sửa/xóa của mình
CREATE POLICY qbank_select ON public.question_bank FOR SELECT TO authenticated
  USING (public.is_teacher());
CREATE POLICY qbank_insert ON public.question_bank FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_teacher());
CREATE POLICY qbank_update ON public.question_bank FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY qbank_delete ON public.question_bank FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- student_mistakes: riêng tư từng học sinh
CREATE POLICY mistakes_all ON public.student_mistakes FOR ALL TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Thu hồi quyền anon trên mọi bảng (100% người dùng phải đăng nhập)
REVOKE ALL ON public.profiles, public.classrooms, public.class_memberships, public.exams,
              public.exam_assignments, public.submissions, public.question_bank,
              public.exam_answer_keys, public.student_mistakes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM authenticated;

-- 4. KHÓA CỘT NHẠY CẢM CỦA PROFILES -----------------------------------
CREATE OR REPLACE FUNCTION public.profiles_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Email là định danh khóa cứng
    IF NEW.email IS DISTINCT FROM OLD.email AND OLD.email IS NOT NULL THEN
      RAISE EXCEPTION 'Không được đổi email';
    END IF;
    -- Chỉ đổi vai trò khi hồ sơ còn dang dở (chưa có SĐT)
    IF NEW.role IS DISTINCT FROM OLD.role AND OLD.phone IS NOT NULL THEN
      RAISE EXCEPTION 'Không được đổi vai trò';
    END IF;
  END IF;
  IF NEW.role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'Vai trò không hợp lệ';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_profiles_guard ON public.profiles;
CREATE TRIGGER trg_profiles_guard BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- Tự tạo profile khi đăng ký bằng email (metadata có phone); OAuth vẫn qua CompleteProfile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
BEGIN
  IF m ? 'phone' AND COALESCE(m->>'phone','') <> '' THEN
    INSERT INTO public.profiles (id, email, role, full_name, phone, school, dob, user_code)
    VALUES (NEW.id, NEW.email,
            CASE WHEN m->>'role' = 'teacher' THEN 'teacher' ELSE 'student' END,
            COALESCE(NULLIF(m->>'full_name',''), 'Người Dùng'),
            m->>'phone', m->>'school',
            NULLIF(m->>'dob','')::date, m->>'user_code')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. VIEW CÔNG KHAI (không lộ đáp án) ----------------------------------
DROP VIEW IF EXISTS public.public_exams;
CREATE VIEW public.public_exams AS
  SELECT id, short_id, author_id, created_by, title, subject, grade, duration_minutes,
         pdf_r2_url, pdf_url, status, allow_multiple_attempts, grading_config, config,
         teacher_name, start_at, end_at, is_private, is_active, created_at, updated_at
  FROM public.exams
  WHERE is_active = true;

DROP VIEW IF EXISTS public.public_leaderboard;
CREATE VIEW public.public_leaderboard AS
  SELECT id, exam_id, student_id, student_name, class_name, school, score, total_score,
         cheat_count, total_away_seconds, status, started_at, submitted_at
  FROM public.submissions
  WHERE status = 'submitted';

REVOKE ALL ON public.public_exams, public.public_leaderboard FROM anon, public;
GRANT SELECT ON public.public_exams, public.public_leaderboard TO authenticated;

-- 6. RPC HỖ TRỢ ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.phone_taken(p_phone text, p_exclude uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE phone = p_phone AND (p_exclude IS NULL OR id <> p_exclude));
$$;
GRANT EXECUTE ON FUNCTION public.phone_taken(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_class_by_code(p_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(c) || jsonb_build_object('teacher_name', COALESCE(p.full_name, 'Thầy/Cô'))
  FROM classrooms c LEFT JOIN profiles p ON p.id = c.teacher_id
  WHERE c.class_code = upper(trim(p_code)) AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.get_answer_keys_after_submit(p_exam_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.owns_exam(p_exam_id) OR EXISTS (
      SELECT 1 FROM submissions WHERE exam_id = p_exam_id AND student_id = auth.uid() AND status = 'submitted')) THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT jsonb_build_object('part_1', part_1_keys, 'part_2', part_2_keys, 'part_3', part_3_keys)
          FROM exam_answer_keys WHERE exam_id = p_exam_id);
END $$;

-- 7. BẮT ĐẦU / LƯU NHÁP / NỘP BÀI (mọi thao tác ghi submissions đi qua đây)
-- Chấm điểm thuần (không đụng bảng): dùng chung cho nộp bài và nhập file cứu hộ
CREATE OR REPLACE FUNCTION public.grade_answers(p_config jsonb, p_keys jsonb, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_config JSONB;
  v_keys JSONB := p_keys;
  v_total_score NUMERIC(5,2) := 0.0;
  v_score_details JSONB := '{"part_1":{},"part_2":{},"part_3":{}}'::jsonb;
  v_q_idx INT;
  v_p1_key TEXT; v_p1_ans TEXT;
  v_sub TEXT;
  v_sub_items TEXT[] := ARRAY['a','b','c','d'];
  v_correct_sub_count INT;
  v_p2_score NUMERIC(5,3);
  v_p2_sub_details JSONB;
  v_ans_sub TEXT; v_key_sub TEXT;
  v_clean_key TEXT; v_clean_ans TEXT;
  v_p1_count INT; v_p2_count INT; v_p3_count INT;
  v_p1_total NUMERIC(5,2); v_p2_total NUMERIC(5,2); v_p3_total NUMERIC(5,2);
  v_p1_unit NUMERIC(5,3); v_p2_base NUMERIC(5,3); v_p3_unit NUMERIC(5,3);
  v_ratio NUMERIC(5,2);
BEGIN
  v_config := p_config;
  v_p1_count := COALESCE((v_config->'sections'->0->>'question_count')::int, 0);
  v_p2_count := COALESCE((v_config->'sections'->1->>'question_count')::int, 0);
  v_p3_count := COALESCE((v_config->'sections'->2->>'question_count')::int, 0);
  v_p1_total := COALESCE((v_config->'sections'->0->>'total_score')::numeric, (v_config->>'p1_total_score')::numeric, 3.0);
  v_p2_total := COALESCE((v_config->'sections'->1->>'total_score')::numeric, (v_config->>'p2_total_score')::numeric, 4.0);
  v_p3_total := COALESCE((v_config->'sections'->2->>'total_score')::numeric, (v_config->>'p3_total_score')::numeric, 3.0);
  v_p1_unit := CASE WHEN v_p1_count > 0 THEN (v_p1_total / v_p1_count) ELSE 0 END;
  v_p2_base := CASE WHEN v_p2_count > 0 THEN (v_p2_total / v_p2_count) ELSE 0 END;
  v_p3_unit := CASE WHEN v_p3_count > 0 THEN (v_p3_total / v_p3_count) ELSE 0 END;

  -- PHẦN I
  IF v_p1_count > 0 THEN
    FOR v_q_idx IN 1..v_p1_count LOOP
      v_p1_key := UPPER(TRIM(COALESCE(v_keys->'part_1'->>v_q_idx::text, '')));
      v_p1_ans := UPPER(TRIM(COALESCE(p_answers->'part_1'->>v_q_idx::text, '')));
      IF v_p1_ans <> '' AND v_p1_ans = v_p1_key THEN
        v_total_score := v_total_score + v_p1_unit;
        v_score_details := jsonb_set(v_score_details, ARRAY['part_1', v_q_idx::text],
          jsonb_build_object('is_correct', true, 'score', ROUND(v_p1_unit, 2), 'student_ans', v_p1_ans, 'key', v_p1_key));
      ELSE
        v_score_details := jsonb_set(v_score_details, ARRAY['part_1', v_q_idx::text],
          jsonb_build_object('is_correct', false, 'score', 0, 'student_ans', v_p1_ans, 'key', v_p1_key));
      END IF;
    END LOOP;
  END IF;

  -- PHẦN II (10% - 25% - 50% - 100%)
  IF v_p2_count > 0 THEN
    FOR v_q_idx IN 1..v_p2_count LOOP
      v_correct_sub_count := 0;
      v_p2_sub_details := '{}'::jsonb;
      FOREACH v_sub IN ARRAY v_sub_items LOOP
        v_ans_sub := LOWER(TRIM(COALESCE(p_answers->'part_2'->v_q_idx::text->>v_sub, '')));
        v_key_sub := LOWER(TRIM(COALESCE(v_keys->'part_2'->v_q_idx::text->>v_sub, '')));
        IF v_ans_sub <> '' AND v_ans_sub = v_key_sub THEN
          v_correct_sub_count := v_correct_sub_count + 1;
          v_p2_sub_details := jsonb_set(v_p2_sub_details, ARRAY[v_sub], 'true'::jsonb);
        ELSE
          v_p2_sub_details := jsonb_set(v_p2_sub_details, ARRAY[v_sub], 'false'::jsonb);
        END IF;
      END LOOP;
      CASE v_correct_sub_count
        WHEN 1 THEN v_ratio := 0.10;
        WHEN 2 THEN v_ratio := 0.25;
        WHEN 3 THEN v_ratio := 0.50;
        WHEN 4 THEN v_ratio := 1.00;
        ELSE v_ratio := 0.00;
      END CASE;
      v_p2_score := ROUND(v_ratio * v_p2_base, 3);
      v_total_score := v_total_score + v_p2_score;
      v_score_details := jsonb_set(v_score_details, ARRAY['part_2', v_q_idx::text],
        jsonb_build_object('correct_count', v_correct_sub_count, 'score', ROUND(v_p2_score, 2), 'details', v_p2_sub_details));
    END LOOP;
  END IF;

  -- PHẦN III (không phân biệt , và .)
  IF v_p3_count > 0 THEN
    FOR v_q_idx IN 1..v_p3_count LOOP
      v_clean_key := REPLACE(REGEXP_REPLACE(COALESCE(v_keys->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.');
      v_clean_ans := REPLACE(REGEXP_REPLACE(COALESCE(p_answers->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.');
      v_clean_key := REGEXP_REPLACE(v_clean_key, '^\+', '');
      v_clean_ans := REGEXP_REPLACE(v_clean_ans, '^\+', '');
      IF v_clean_ans <> '' AND (
           v_clean_ans = v_clean_key
           OR (v_clean_ans ~ '^-?[0-9]+(\.[0-9]+)?$' AND v_clean_key ~ '^-?[0-9]+(\.[0-9]+)?$'
               AND v_clean_ans::numeric = v_clean_key::numeric)
      ) THEN
        v_total_score := v_total_score + v_p3_unit;
        v_score_details := jsonb_set(v_score_details, ARRAY['part_3', v_q_idx::text],
          jsonb_build_object('is_correct', true, 'score', ROUND(v_p3_unit, 2), 'student_ans', v_clean_ans, 'key', v_clean_key));
      ELSE
        v_score_details := jsonb_set(v_score_details, ARRAY['part_3', v_q_idx::text],
          jsonb_build_object('is_correct', false, 'score', 0, 'student_ans', v_clean_ans, 'key', v_clean_key));
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('score', ROUND(v_total_score, 2), 'details', v_score_details);
END $$;
REVOKE ALL ON FUNCTION public.grade_answers(jsonb,jsonb,jsonb) FROM public, anon, authenticated;

DROP FUNCTION IF EXISTS public.submit_and_grade_exam(uuid, uuid, text, text, jsonb, int, int, uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.start_attempt(
  p_exam_id uuid, p_session_token uuid, p_student_name text, p_class_name text DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_exam RECORD; v_started timestamptz; v_owner uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.'; END IF;
  IF v_exam.start_at IS NOT NULL AND now() < v_exam.start_at THEN RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở'; END IF;
  IF v_exam.end_at IS NOT NULL AND now() > v_exam.end_at THEN RAISE EXCEPTION 'Kỳ thi đã kết thúc'; END IF;

  INSERT INTO submissions (exam_id, student_id, student_name, class_name, session_token, status)
  VALUES (p_exam_id, v_uid, COALESCE(NULLIF(p_student_name,''), 'Học sinh'), p_class_name, p_session_token, 'in_progress')
  ON CONFLICT (exam_id, session_token) DO NOTHING;

  SELECT started_at, student_id INTO v_started, v_owner
  FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF v_owner IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
  RETURN v_started;
END $$;

CREATE OR REPLACE FUNCTION public.save_draft(
  p_exam_id uuid, p_session_token uuid, p_student_name text, p_class_name text, p_answers jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;
  PERFORM public.start_attempt(p_exam_id, p_session_token, p_student_name, p_class_name);
  UPDATE submissions
     SET answers = p_answers, student_answers = p_answers
   WHERE exam_id = p_exam_id AND session_token = p_session_token
     AND student_id = v_uid AND status = 'in_progress';
END $$;

CREATE OR REPLACE FUNCTION public.submit_and_grade_exam(
  p_exam_id uuid,
  p_session_token uuid,
  p_student_name text,
  p_class_name text,
  p_answers jsonb,
  p_cheat_count int,
  p_total_away_seconds int,
  p_student_id uuid DEFAULT NULL,   -- BỊ BỎ QUA: luôn dùng auth.uid()
  p_class_id uuid DEFAULT NULL,
  p_school text DEFAULT NULL,
  p_telemetry jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_exam RECORD;
  v_kr RECORD;
  v_prev RECORD;
  v_keys JSONB;
  v_config JSONB;
  v_grade JSONB;
  v_total_score NUMERIC(5,2) := 0.0;
  v_score_details JSONB := '{"part_1":{},"part_2":{},"part_3":{}}'::jsonb;
  v_q_idx INT;
  v_p1_key TEXT; v_p1_ans TEXT;
  v_sub TEXT;
  v_sub_items TEXT[] := ARRAY['a','b','c','d'];
  v_correct_sub_count INT;
  v_p2_score NUMERIC(5,3);
  v_p2_sub_details JSONB;
  v_ans_sub TEXT; v_key_sub TEXT;
  v_clean_key TEXT; v_clean_ans TEXT;
  v_p1_count INT; v_p2_count INT; v_p3_count INT;
  v_p1_total NUMERIC(5,2); v_p2_total NUMERIC(5,2); v_p3_total NUMERIC(5,2);
  v_p1_unit NUMERIC(5,3); v_p2_base NUMERIC(5,3); v_p3_unit NUMERIC(5,3);
  v_ratio NUMERIC(5,2);
  v_attempt INT;
  v_class UUID;
  v_telemetry JSONB := COALESCE(p_telemetry, '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Cần đăng nhập để nộp bài'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.'; END IF;
  IF v_exam.start_at IS NOT NULL AND now() < v_exam.start_at THEN RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở'; END IF;
  -- Dung sai 2 phút (jitter 30s + trễ mạng)
  IF v_exam.end_at IS NOT NULL AND now() > (v_exam.end_at + INTERVAL '2 minutes') THEN
    RAISE EXCEPTION 'Kỳ thi đã kết thúc';
  END IF;

  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys);

  -- Phiên hiện có: đúng chủ, chưa nộp, chưa quá giờ
  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF FOUND THEN
    IF v_prev.student_id IS DISTINCT FROM v_uid THEN RAISE EXCEPTION 'Phiên làm bài không hợp lệ'; END IF;
    IF v_prev.status = 'submitted' THEN   -- idempotent: trả kết quả đã chấm
      RETURN jsonb_build_object('status','success','score', v_prev.total_score,
                                'score_details', v_prev.score_details, 'answer_keys', v_keys);
    END IF;
    IF v_exam.duration_minutes > 0
       AND now() > v_prev.started_at + make_interval(mins => v_exam.duration_minutes) + INTERVAL '3 minutes' THEN
      RAISE EXCEPTION 'Đã quá thời gian làm bài';
    END IF;
  END IF;

  -- Số lần làm bài
  SELECT count(*) INTO v_attempt FROM submissions
   WHERE exam_id = p_exam_id AND student_id = v_uid AND status = 'submitted' AND session_token <> p_session_token;
  IF NOT v_exam.allow_multiple_attempts AND v_attempt > 0 THEN
    RAISE EXCEPTION 'Đề này chỉ cho phép làm 1 lần';
  END IF;
  v_attempt := v_attempt + 1;

  v_class := CASE WHEN p_class_id IS NOT NULL AND public.is_class_member(p_class_id) THEN p_class_id END;

  IF jsonb_typeof(v_telemetry) <> 'array' THEN v_telemetry := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_telemetry) > 500 THEN
    SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) INTO v_telemetry
    FROM (SELECT e FROM jsonb_array_elements(v_telemetry) e LIMIT 500) x;
  END IF;

  v_grade := public.grade_answers(v_exam.config, v_keys, p_answers);
  v_total_score := (v_grade->>'score')::numeric;
  v_score_details := v_grade->'details';

  INSERT INTO submissions (
    exam_id, session_token, student_name, class_name, answers, student_answers, score, total_score,
    score_details, cheat_count, total_away_seconds, telemetry_logs, attempt_number, status, submitted_at,
    student_id, class_id, school
  ) VALUES (
    p_exam_id, p_session_token, COALESCE(NULLIF(p_student_name,''), 'Học sinh'), p_class_name,
    p_answers, p_answers, ROUND(v_total_score, 2), ROUND(v_total_score, 2),
    v_score_details, GREATEST(COALESCE(p_cheat_count,0),0), GREATEST(COALESCE(p_total_away_seconds,0),0),
    v_telemetry, v_attempt, 'submitted', now(), v_uid, v_class, p_school
  )
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
    answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
    score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
    cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
    telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
    status = 'submitted', submitted_at = now(),
    class_id = COALESCE(EXCLUDED.class_id, submissions.class_id),
    school = COALESCE(EXCLUDED.school, submissions.school);

  RETURN jsonb_build_object('status','success','score', ROUND(v_total_score, 2),
                            'score_details', v_score_details, 'answer_keys', v_keys);
END $$;

-- Giáo viên nhập file cứu hộ (.yuhquiz) của học sinh mất mạng lúc nộp
CREATE OR REPLACE FUNCTION public.teacher_import_rescue(
  p_exam_id uuid, p_student_id uuid, p_session_token uuid, p_answers jsonb,
  p_cheat_count int DEFAULT 0, p_total_away_seconds int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD; v_kr RECORD; v_keys jsonb; v_grade jsonb; v_prev RECORD;
  v_name text; v_attempt int;
BEGIN
  IF NOT public.owns_exam(p_exam_id) THEN RAISE EXCEPTION 'Bạn không sở hữu đề này'; END IF;
  IF NOT public.teaches_student(p_student_id) THEN RAISE EXCEPTION 'Học sinh không thuộc lớp của bạn'; END IF;
  IF length(p_answers::text) > 200000 THEN RAISE EXCEPTION 'Dữ liệu bài làm quá lớn'; END IF;

  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys);
  v_grade := public.grade_answers(v_exam.config, v_keys, p_answers);

  SELECT * INTO v_prev FROM submissions WHERE exam_id = p_exam_id AND session_token = p_session_token;
  IF FOUND AND v_prev.student_id IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'File cứu hộ này thuộc học sinh khác';
  END IF;
  IF FOUND AND v_prev.status = 'submitted' THEN
    RAISE EXCEPTION 'Bài này đã được nộp/nhập trước đó';
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = p_student_id;
  SELECT count(*) + 1 INTO v_attempt FROM submissions
   WHERE exam_id = p_exam_id AND student_id = p_student_id AND status = 'submitted';

  INSERT INTO submissions (exam_id, session_token, student_id, student_name, answers, student_answers,
      score, total_score, score_details, cheat_count, total_away_seconds, telemetry_logs,
      attempt_number, status, submitted_at)
  VALUES (p_exam_id, p_session_token, p_student_id, COALESCE(v_name,'Học sinh'), p_answers, p_answers,
      (v_grade->>'score')::numeric, (v_grade->>'score')::numeric, v_grade->'details',
      GREATEST(COALESCE(p_cheat_count,0),0), GREATEST(COALESCE(p_total_away_seconds,0),0),
      '[{"type":"imported_from_rescue_file"}]'::jsonb, v_attempt, 'submitted', now())
  ON CONFLICT (exam_id, session_token) DO UPDATE SET
      answers = EXCLUDED.answers, student_answers = EXCLUDED.student_answers,
      score = EXCLUDED.score, total_score = EXCLUDED.total_score, score_details = EXCLUDED.score_details,
      cheat_count = EXCLUDED.cheat_count, total_away_seconds = EXCLUDED.total_away_seconds,
      telemetry_logs = EXCLUDED.telemetry_logs, attempt_number = EXCLUDED.attempt_number,
      status = 'submitted', submitted_at = now();

  RETURN jsonb_build_object('status','success','score',(v_grade->>'score')::numeric,'student_name',v_name);
END $$;
REVOKE ALL ON FUNCTION public.teacher_import_rescue(uuid,uuid,uuid,jsonb,int,int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_import_rescue(uuid,uuid,uuid,jsonb,int,int) TO authenticated;

-- Giáo viên chấm lại / thu bài (thay cho UPDATE trực tiếp bảng submissions, đã bị thu quyền)
--   p_submission_id NULL  → chấm lại toàn bộ bài của đề (giữ nguyên trạng thái từng bài)
--   p_force_submit = true → thu bài: chuyển 'submitted' và chốt giờ nộp (chỉ dùng với 1 bài)
CREATE OR REPLACE FUNCTION public.teacher_regrade(
  p_exam_id uuid, p_submission_id uuid DEFAULT NULL, p_force_submit boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exam RECORD; v_kr RECORD; v_keys jsonb; v_sub RECORD; v_grade jsonb;
  v_count int := 0; v_last numeric;
BEGIN
  IF NOT public.owns_exam(p_exam_id) THEN RAISE EXCEPTION 'Bạn không sở hữu đề này'; END IF;
  IF p_force_submit AND p_submission_id IS NULL THEN RAISE EXCEPTION 'Thu bài phải chỉ rõ 1 bài'; END IF;
  SELECT * INTO v_exam FROM exams WHERE id = p_exam_id;
  SELECT * INTO v_kr FROM exam_answer_keys WHERE exam_id = p_exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Đề chưa có đáp án'; END IF;
  v_keys := jsonb_build_object('part_1', v_kr.part_1_keys, 'part_2', v_kr.part_2_keys, 'part_3', v_kr.part_3_keys);

  FOR v_sub IN
    SELECT * FROM submissions
     WHERE exam_id = p_exam_id AND (p_submission_id IS NULL OR id = p_submission_id)
  LOOP
    -- student_answers mặc định '{}' (không null): lấy cột nào thực sự có dữ liệu
    v_grade := public.grade_answers(v_exam.config, v_keys,
      CASE WHEN v_sub.student_answers IS NULL OR v_sub.student_answers = '{}'::jsonb
           THEN COALESCE(v_sub.answers, '{}'::jsonb) ELSE v_sub.student_answers END);
    UPDATE submissions SET
      score = (v_grade->>'score')::numeric,
      total_score = (v_grade->>'score')::numeric,
      score_details = v_grade->'details',
      status = CASE WHEN p_force_submit THEN 'submitted' ELSE status END,
      submitted_at = CASE WHEN p_force_submit THEN now() ELSE submitted_at END
    WHERE id = v_sub.id;
    v_count := v_count + 1;
    v_last := (v_grade->>'score')::numeric;
  END LOOP;
  IF p_submission_id IS NOT NULL AND v_count = 0 THEN RAISE EXCEPTION 'Không tìm thấy bài làm để chấm'; END IF;
  RETURN jsonb_build_object('count', v_count, 'score', CASE WHEN p_submission_id IS NOT NULL THEN v_last END);
END $$;
REVOKE ALL ON FUNCTION public.teacher_regrade(uuid,uuid,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.teacher_regrade(uuid,uuid,boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.start_attempt(uuid,uuid,text,text),
                       public.save_draft(uuid,uuid,text,text,jsonb),
                       public.submit_and_grade_exam(uuid,uuid,text,text,jsonb,int,int,uuid,uuid,text,jsonb),
                       public.get_answer_keys_after_submit(uuid),
                       public.find_class_by_code(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_attempt(uuid,uuid,text,text),
                          public.save_draft(uuid,uuid,text,text,jsonb),
                          public.submit_and_grade_exam(uuid,uuid,text,text,jsonb,int,int,uuid,uuid,text,jsonb),
                          public.get_answer_keys_after_submit(uuid),
                          public.find_class_by_code(text) TO authenticated;

-- 8. KHÔNG DÙNG REALTIME (tránh trần 200 kết nối của Free tier)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='submissions') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.submissions;
  END IF;
END $$;

-- 9. STORAGE: ảnh câu hỏi (public read, chỉ giáo viên ghi vào thư mục của mình) ---
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('question-images', 'question-images', true, 512000, ARRAY['image/webp','image/png','image/jpeg'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = 512000;

DROP POLICY IF EXISTS "qimg_insert" ON storage.objects;
CREATE POLICY "qimg_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-images' AND public.is_teacher()
              AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "qimg_delete" ON storage.objects;
CREATE POLICY "qimg_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question-images' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "qimg_select" ON storage.objects;
CREATE POLICY "qimg_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

-- 10. PING chống ngủ đông (anon gọi được, không đọc dữ liệu)
CREATE OR REPLACE FUNCTION public.ping() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT 'pong'::text; $$;
GRANT EXECUTE ON FUNCTION public.ping() TO anon, authenticated;

-- 11. GIỚI HẠN TẦN SUẤT ĐĂNG NHẬP (BFF gọi bằng anon key; bảng đóng hoàn toàn với client)
--   Khóa là sha256(ip|email) do BFF tính → người ngoài không khóa được tài khoản người khác nếu không biết IP của họ.
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  key text NOT NULL,
  at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_attempts_key_at ON public.auth_attempts(key, at);
ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_attempts FROM anon, authenticated, public;

-- Trả về số giây phải chờ (0 = được phép thử)
CREATE OR REPLACE FUNCTION public.auth_rl_check(p_key text, p_max int, p_window_seconds int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int; v_oldest timestamptz;
BEGIN
  IF p_key !~ '^[0-9a-f]{64}$' OR p_max NOT BETWEEN 1 AND 1000 OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
    RAISE EXCEPTION 'Tham số không hợp lệ';
  END IF;
  SELECT count(*), min(at) INTO v_count, v_oldest FROM auth_attempts
   WHERE key = p_key AND at > now() - make_interval(secs => p_window_seconds);
  IF v_count >= p_max THEN
    RETURN GREATEST(1, ceil(extract(epoch FROM (v_oldest + make_interval(secs => p_window_seconds) - now())))::int);
  END IF;
  RETURN 0;
END $$;

CREATE OR REPLACE FUNCTION public.auth_rl_fail(p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Tham số không hợp lệ'; END IF;
  -- Chặn phình bảng: mỗi khóa tối đa 50 dòng còn hiệu lực
  IF (SELECT count(*) FROM auth_attempts WHERE key = p_key AND at > now() - interval '1 day') < 50 THEN
    INSERT INTO auth_attempts(key) VALUES (p_key);
  END IF;
  IF random() < 0.05 THEN DELETE FROM auth_attempts WHERE at < now() - interval '1 day'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.auth_rl_reset(p_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_key !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Tham số không hợp lệ'; END IF;
  DELETE FROM auth_attempts WHERE key = p_key;
END $$;

REVOKE ALL ON FUNCTION public.auth_rl_check(text,int,int), public.auth_rl_fail(text), public.auth_rl_reset(text) FROM public;
GRANT EXECUTE ON FUNCTION public.auth_rl_check(text,int,int), public.auth_rl_fail(text), public.auth_rl_reset(text) TO anon, authenticated;
