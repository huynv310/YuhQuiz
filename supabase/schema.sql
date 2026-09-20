-- ====================================================================
-- YUHQUIZ - NỀN TẢNG KHẢO THÍ & QUẢN LÝ LỚP HỌC TRỰC TUYẾN
-- BẢN NÂNG CẤP TOÀN DIỆN (CHUẨN HÓA THEO BÁO CÁO KIẾN TRÚC)
-- ====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 1. ENUM TYPES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('teacher', 'student');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'exam_status') THEN
        CREATE TYPE exam_status AS ENUM ('draft', 'published', 'archived');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'submission_status') THEN
        CREATE TYPE submission_status AS ENUM ('in_progress', 'submitted', 'abandoned');
    END IF;
END $$;

-- 2. BẢNG HỒ SƠ NGƯỜI DÙNG (profiles)
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

-- 3. BẢNG LỚP HỌC (classrooms)
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

-- 4. BẢNG THÀNH VIÊN LỚP (class_memberships)
CREATE TABLE IF NOT EXISTS public.class_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_name TEXT,     -- Tương thích ngược
    student_phone TEXT,    -- Tương thích ngược
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, student_id)
);

-- 5. BẢNG KỲ THI (exams)
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

-- 6. BẢNG GIAO ĐỀ (exam_assignments)
CREATE TABLE IF NOT EXISTS public.exam_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_id, class_id)
);

-- 7. BẢNG KHO BÀI TẬP (question_bank) - THÊM MỚI THEO BLUEPRINT
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

-- 8. BẢNG ĐÁP ÁN FORM 2025 (exam_answer_keys) - THÊM MỚI THEO BLUEPRINT
CREATE TABLE IF NOT EXISTS public.exam_answer_keys (
    exam_id UUID PRIMARY KEY REFERENCES public.exams(id) ON DELETE CASCADE,
    part_1_keys JSONB DEFAULT '{}',
    part_2_keys JSONB DEFAULT '{}',
    part_3_keys JSONB DEFAULT '{}',
    question_snippets JSONB DEFAULT '{}',
    solutions JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BÀI NỘP CỦA HỌC SINH (submissions)
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

-- 10. SỔ TAY CÂU SAI SM-2 (student_mistakes) - THÊM MỚI THEO BLUEPRINT
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

-- 11. INDEXES
CREATE INDEX IF NOT EXISTS idx_exams_title_trgm ON public.exams USING gin (lower(title) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON public.classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_student ON public.class_memberships(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_exam_score ON public.submissions(exam_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON public.submissions(student_id);

-- 12. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mistakes ENABLE ROW LEVEL SECURITY;

-- Tạo các Policy cơ bản cho phép đọc/ghi công khai (Phục vụ phát triển nhanh, cần siết lại ở Production)
DO $$ 
BEGIN
    -- profiles
    DROP POLICY IF EXISTS "Cho phép xem profiles" ON profiles;
    CREATE POLICY "Cho phép xem profiles" ON profiles FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Cho phép tạo profiles" ON profiles;
    CREATE POLICY "Cho phép tạo profiles" ON profiles FOR INSERT WITH CHECK (true);
    DROP POLICY IF EXISTS "Cho phép cập nhật profiles" ON profiles;
    CREATE POLICY "Cho phép cập nhật profiles" ON profiles FOR UPDATE USING (auth.uid() = id);

    -- exams
    DROP POLICY IF EXISTS "Cho phép đọc exams" ON exams;
    CREATE POLICY "Cho phép đọc exams" ON exams FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Cho phép thêm exams" ON exams;
    CREATE POLICY "Cho phép thêm exams" ON exams FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Cho phép sửa exams" ON exams;
    CREATE POLICY "Cho phép sửa exams" ON exams FOR UPDATE USING (auth.role() = 'authenticated');
    DROP POLICY IF EXISTS "Cho phép xóa exams" ON exams;
    CREATE POLICY "Cho phép xóa exams" ON exams FOR DELETE USING (auth.role() = 'authenticated');

    -- submissions
    DROP POLICY IF EXISTS "Cho phép đọc submissions" ON submissions;
    CREATE POLICY "Cho phép đọc submissions" ON submissions FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Cho phép tạo submissions" ON submissions;
    CREATE POLICY "Cho phép tạo submissions" ON submissions FOR INSERT WITH CHECK (true);
    DROP POLICY IF EXISTS "Cho phép cập nhật submissions" ON submissions;
    CREATE POLICY "Cho phép cập nhật submissions" ON submissions FOR UPDATE USING (true);
END $$;

-- Bật Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'submissions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
  END IF;
END $$;

-- 13. HÀM CHẤM ĐIỂM (RPC) Tương thích ngược
CREATE OR REPLACE FUNCTION submit_and_grade_exam(
    p_exam_id UUID,
    p_session_token UUID,
    p_student_name TEXT,
    p_class_name TEXT,
    p_answers JSONB,
    p_cheat_count INT,
    p_total_away_seconds INT,
    p_student_id UUID DEFAULT NULL,
    p_class_id UUID DEFAULT NULL,
    p_school TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_exam RECORD;
    v_keys JSONB;
    v_config JSONB;
    v_total_score NUMERIC(5,2) := 0.0;
    v_score_details JSONB := '{"part_1":{},"part_2":{},"part_3":{}}'::jsonb;
    
    v_q_idx INT;
    v_p1_key TEXT;
    v_p1_ans TEXT;
    
    v_sub TEXT;
    v_sub_items TEXT[] := ARRAY['a', 'b', 'c', 'd'];
    v_correct_sub_count INT;
    v_p2_score NUMERIC(5,3);
    v_p2_sub_details JSONB;
    v_ans_sub TEXT;
    v_key_sub TEXT;
    
    v_clean_key TEXT;
    v_clean_ans TEXT;
    
    v_p1_count INT;
    v_p2_count INT;
    v_p3_count INT;
    v_p1_total NUMERIC(5,2);
    v_p2_total NUMERIC(5,2);
    v_p3_total NUMERIC(5,2);
    v_p1_unit NUMERIC(5,3);
    v_p2_base NUMERIC(5,3);
    v_p3_unit NUMERIC(5,3);
    v_ratio NUMERIC(5,2);
BEGIN
    SELECT * INTO v_exam FROM exams WHERE id = p_exam_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Kỳ thi không tồn tại hoặc đã đóng.';
    END IF;

    -- Kiểm tra thời gian mở / đóng đề nếu có
    IF v_exam.start_at IS NOT NULL AND now() < v_exam.start_at THEN
        RAISE EXCEPTION 'Kỳ thi chưa đến giờ mở';
    END IF;
    IF v_exam.end_at IS NOT NULL AND now() > (v_exam.end_at + INTERVAL '2 minutes') THEN
        RAISE EXCEPTION 'Kỳ thi đã kết thúc';
    END IF;

    v_keys := v_exam.answer_keys;
    v_config := v_exam.config;

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

    -- PHẦN II
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

    -- PHẦN III
    IF v_p3_count > 0 THEN
        FOR v_q_idx IN 1..v_p3_count LOOP
            v_clean_key := REPLACE(REGEXP_REPLACE(COALESCE(v_keys->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.');
            v_clean_ans := REPLACE(REGEXP_REPLACE(COALESCE(p_answers->'part_3'->>v_q_idx::text, ''), '\s+', '', 'g'), ',', '.');

            v_clean_key := REGEXP_REPLACE(v_clean_key, '^\+', '');
            v_clean_ans := REGEXP_REPLACE(v_clean_ans, '^\+', '');

            IF v_clean_ans <> '' AND (
                v_clean_ans = v_clean_key 
                OR (
                    v_clean_ans ~ '^-?[0-9]+(\.[0-9]+)?$' 
                    AND v_clean_key ~ '^-?[0-9]+(\.[0-9]+)?$' 
                    AND v_clean_ans::numeric = v_clean_key::numeric
                )
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

    INSERT INTO submissions (
        exam_id, session_token, student_name, class_name,
        answers, student_answers, score, total_score, score_details, cheat_count, total_away_seconds, status, submitted_at,
        student_id, class_id, school
    ) VALUES (
        p_exam_id, p_session_token, p_student_name, p_class_name,
        p_answers, p_answers, ROUND(v_total_score, 2), ROUND(v_total_score, 2), v_score_details, p_cheat_count, p_total_away_seconds, 'submitted', now(),
        p_student_id, p_class_id, p_school
    )
    ON CONFLICT (exam_id, session_token)
    DO UPDATE SET
        answers = EXCLUDED.answers,
        student_answers = EXCLUDED.student_answers,
        score = EXCLUDED.score,
        total_score = EXCLUDED.total_score,
        score_details = EXCLUDED.score_details,
        cheat_count = EXCLUDED.cheat_count,
        total_away_seconds = EXCLUDED.total_away_seconds,
        status = 'submitted',
        submitted_at = now(),
        student_id = COALESCE(EXCLUDED.student_id, submissions.student_id),
        class_id = COALESCE(EXCLUDED.class_id, submissions.class_id),
        school = COALESCE(EXCLUDED.school, submissions.school);

    RETURN jsonb_build_object(
        'status', 'success',
        'score', ROUND(v_total_score, 2),
        'score_details', v_score_details,
        'answer_keys', v_keys
    );
END;
$$;
