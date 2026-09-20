export interface SubjectPreset {
  name: string;
  duration: number; // Thời gian làm bài chuẩn (phút)
  p1Count: number;  // Số câu Phần I (Trắc nghiệm đơn 4 phương án)
  p1Score: number;  // Tổng điểm Phần I
  p2Count: number;  // Số câu Phần II (Đúng/Sai)
  p2Score: number;  // Tổng điểm Phần II
  p3Count: number;  // Số câu Phần III (Trả lời ngắn)
  p3Score: number;  // Tổng điểm Phần III
  color: string;
  badge: string;
}

// Bảng Preset chuẩn tất cả các môn thi theo Quyết định 764/QĐ-BGDĐT
export const SUBJECT_PRESETS: Record<string, SubjectPreset> = {
  'Toán': {
    name: 'Toán',
    duration: 90,
    p1Count: 12, p1Score: 3.0,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 6,  p3Score: 3.0,
    color: '#3B82F6',
    badge: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  'Vật lí': {
    name: 'Vật lí',
    duration: 50,
    p1Count: 18, p1Score: 4.5,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 6,  p3Score: 1.5,
    color: '#6366F1',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  'Hóa học': {
    name: 'Hóa học',
    duration: 50,
    p1Count: 18, p1Score: 4.5,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 6,  p3Score: 1.5,
    color: '#F59E0B',
    badge: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  'Sinh học': {
    name: 'Sinh học',
    duration: 50,
    p1Count: 18, p1Score: 4.5,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 6,  p3Score: 1.5,
    color: '#10B981',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  'Địa lí': {
    name: 'Địa lí',
    duration: 50,
    p1Count: 18, p1Score: 4.5,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 6,  p3Score: 1.5,
    color: '#0D9488',
    badge: 'bg-teal-50 text-teal-700 border-teal-200'
  },
  'Lịch sử': {
    name: 'Lịch sử',
    duration: 50,
    p1Count: 24, p1Score: 6.0,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 0,  p3Score: 0.0,
    color: '#E11D48',
    badge: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  'GDKT & Pháp luật': {
    name: 'GDKT & Pháp luật',
    duration: 50,
    p1Count: 24, p1Score: 6.0,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 0,  p3Score: 0.0,
    color: '#EA580C',
    badge: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  'Tin học': {
    name: 'Tin học',
    duration: 50,
    p1Count: 24, p1Score: 6.0,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 0,  p3Score: 0.0,
    color: '#0284C7',
    badge: 'bg-sky-50 text-sky-700 border-sky-200'
  },
  'Công nghệ': {
    name: 'Công nghệ',
    duration: 50,
    p1Count: 24, p1Score: 6.0,
    p2Count: 4,  p2Score: 4.0,
    p3Count: 0,  p3Score: 0.0,
    color: '#65A30D',
    badge: 'bg-lime-50 text-lime-700 border-lime-200'
  },
  'Ngoại ngữ': {
    name: 'Ngoại ngữ',
    duration: 50,
    p1Count: 40, p1Score: 10.0,
    p2Count: 0,  p2Score: 0.0,
    p3Count: 0,  p3Score: 0.0,
    color: '#9333EA',
    badge: 'bg-purple-50 text-purple-700 border-purple-200'
  },
};

// Giới hạn trần tối đa câu hỏi để chống spam và cạn kiệt bộ nhớ
export const MAX_QUESTION_LIMITS = {
  P1_MAX: 100, // Tối đa 100 câu mỗi phần (trùng ràng buộc DB)
  P2_MAX: 100,
  P3_MAX: 100,
};

export const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
