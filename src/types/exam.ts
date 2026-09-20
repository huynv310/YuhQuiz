export type QuestionType = 'single_choice' | 'true_false_group' | 'short_answer';

export interface SectionConfig {
  id: string; // 'part_1', 'part_2', 'part_3'
  title: string;
  question_count: number;
  total_score: number;
}

export interface ExamConfig {
  sections: SectionConfig[];
  p1_total_score?: number;
  p2_total_score?: number;
  p3_total_score?: number;
  /** Đề sinh từ Kho bài tập: danh sách ảnh câu hỏi theo thứ tự (thay cho PDF). */
  question_images?: string[];
  source?: 'question_bank';
}

export interface Exam {
  id: string;
  short_id?: string | null;
  grade?: number | null;
  title: string;
  subject: string;
  pdf_url?: string | null;
  config: ExamConfig;
  answer_keys: {
    part_1: Record<number, string>;
    part_2: Record<number, Record<string, boolean>>;
    part_3: Record<number, string>;
  };
  duration_minutes: number;
  teacher_name?: string;
  created_by?: string;
  start_at?: string | null;
  end_at?: string | null;
  is_private?: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  school: string;
  dob?: string | null;
  role: 'teacher' | 'student';
  user_code: string;
  avatar_url?: string | null;
}

export interface Classroom {
  id: string;
  teacher_id: string;
  name: string;
  subject: string;
  school?: string;
  class_code: string;
  created_at: string;
  class_memberships?: { count: number }[];
}

export interface ClassMembership {
  id: string;
  class_id: string;
  student_id: string;
  student_name?: string;
  student_phone?: string;
  joined_at: string;
  profiles?: Profile;
}

export interface ExamAssignment {
  id: string;
  exam_id: string;
  class_id: string;
  start_at?: string | null;
  end_at?: string | null;
  assigned_at: string;
}

export interface Submission {
  id: string;
  exam_id: string;
  student_id?: string | null;
  class_id?: string | null;
  student_name: string;
  class_name: string;
  school?: string | null;
  session_token: string;
  answers: {
    part_1?: Record<number, string>;
    part_2?: Record<number, Record<string, boolean>>;
    part_3?: Record<number, string>;
    timestamps?: {
      part_1?: Record<number, number>;
      part_2?: Record<number, Record<string, number>>;
      part_3?: Record<number, number>;
    };
  };
  score: number | null;
  score_details: {
    part_1?: Record<number, { is_correct: boolean; score: number; student_ans?: string; key?: string }>;
    part_2?: Record<number, { correct_count: number; score: number; details?: Record<string, boolean> }>;
    part_3?: Record<number, { is_correct: boolean; score: number; student_ans?: string; key?: string }>;
  };
  cheat_count: number;
  total_away_seconds: number;
  status: 'in_progress' | 'submitted';
  started_at: string;
  submitted_at: string | null;
}

export interface StudentAnswers {
  part_1?: Record<number, string>;
  part_2?: Record<number, Record<string, boolean>>;
  part_3?: Record<number, string>;
  timestamps?: Record<string, any>;
}

export interface ScoreDetails {
  part_1?: Record<number, { is_correct: boolean; score: number; student_ans?: string; key?: string }>;
  part_2?: Record<number, { correct_count: number; score: number; details?: Record<string, boolean> }>;
  part_3?: Record<number, { is_correct: boolean; score: number; student_ans?: string; key?: string }>;
}
