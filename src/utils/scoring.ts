import { ExamConfig, StudentAnswers, ScoreDetails } from '../types/exam';

export function normalizeShortAnswer(input: string | undefined | null): string {
  if (!input) return '';
  return String(input)
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/^\+/, '');
}

/**
 * Chuẩn hóa chuỗi nhập liệu Phần III (Trả lời ngắn) theo đúng quy định phiếu tô 4 ký tự THPTQG 2025:
 * - Chỉ cho phép chữ số 0-9, dấu trừ (-) ở vị trí đầu tiên, và tối đa 1 dấu phẩy (,) hoặc chấm (.).
 * - Giới hạn cứng tối đa 4 ký tự (bao gồm cả dấu '-' và ',' / '.').
 */
export function sanitizeShortAnswerInput(raw: string | undefined | null): string {
  if (!raw) return '';
  const cleaned = String(raw).replace(/\s+/g, '');
  let out = '';
  let hasDecimal = false;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '-' && out.length === 0) {
      out += '-';
    } else if ((ch === ',' || ch === '.') && !hasDecimal) {
      hasDecimal = true;
      out += ch;
    } else if (ch >= '0' && ch <= '9') {
      out += ch;
    }
    if (out.length >= 4) break;
  }
  return out;
}

export function matchShortAnswer(
  studentInput: string | undefined | null,
  correctKey: string | undefined | null
): boolean {
  if (!studentInput || !correctKey) return false;

  const cleanInput = normalizeShortAnswer(studentInput);
  const cleanKey = normalizeShortAnswer(correctKey);

  if (cleanInput === cleanKey) return true;

  const numInput = Number(cleanInput);
  const numKey = Number(cleanKey);

  if (!isNaN(numInput) && !isNaN(numKey)) {
    return Math.abs(numInput - numKey) < 1e-6;
  }

  return false;
}

/**
 * Thuật toán tính điểm đa môn học với thang đo tùy biến
 */
export function calculateDynamicExamScore(
  answers: StudentAnswers,
  keys: any,
  config: ExamConfig
): {
  totalScore: number;
  maxScore: number;
  scoreDetails: ScoreDetails;
} {
  let totalScore = 0;
  let maxScore = 0;
  const scoreDetails: ScoreDetails = {
    part_1: {},
    part_2: {},
    part_3: {},
  };

  const p1Section = config.sections?.find(s => s.id === 'part_1');
  const p2Section = config.sections?.find(s => s.id === 'part_2');
  const p3Section = config.sections?.find(s => s.id === 'part_3');

  const p1Count = p1Section?.question_count ?? 12;
  const p1TotalScore = p1Section?.total_score ?? config.p1_total_score ?? 3.0;

  const p2Count = p2Section?.question_count ?? 4;
  const p2TotalScore = p2Section?.total_score ?? config.p2_total_score ?? 4.0;

  const p3Count = p3Section?.question_count ?? 6;
  const p3TotalScore = p3Section?.total_score ?? config.p3_total_score ?? 3.0;

  // 1. Chấm Phần I (Trắc nghiệm đơn - Chia đều điểm)
  const p1Unit = p1Count > 0 ? p1TotalScore / p1Count : 0;
  for (let i = 1; i <= p1Count; i++) {
    const studentAns = (answers.part_1?.[i] || '').trim().toUpperCase();
    const correctAns = (keys.part_1?.[i] || '').trim().toUpperCase();
    const isCorrect = Boolean(studentAns && studentAns === correctAns);
    const score = isCorrect ? p1Unit : 0;

    scoreDetails.part_1![i] = {
      is_correct: isCorrect,
      score: Math.round(score * 1000) / 1000,
      student_ans: studentAns,
      key: correctAns,
    };

    if (isCorrect) totalScore += score;
    maxScore += p1Unit;
  }

  // 2. Chấm Phần II (Đúng/Sai - Chia đều theo câu và áp dụng tỷ lệ 10% - 25% - 50% - 100%)
  const p2BasePerQuestion = p2Count > 0 ? p2TotalScore / p2Count : 0;
  for (let i = 1; i <= p2Count; i++) {
    const studentGroup = answers.part_2?.[i] || {};
    const keyGroup = keys.part_2?.[i] || {};
    const subItems = ['a', 'b', 'c', 'd'];

    let correctCount = 0;
    const subDetails: Record<string, boolean> = {};

    for (const sub of subItems) {
      const studentVal = studentGroup[sub];
      const keyVal = keyGroup[sub];
      const isCorrect = studentVal !== undefined && Boolean(studentVal) === Boolean(keyVal);
      subDetails[sub] = isCorrect;
      if (isCorrect) correctCount++;
    }

    let ratio = 0;
    if (correctCount === 1) ratio = 0.10;
    else if (correctCount === 2) ratio = 0.25;
    else if (correctCount === 3) ratio = 0.50;
    else if (correctCount === 4) ratio = 1.00;

    const scoreEarned = Math.round(ratio * p2BasePerQuestion * 1000) / 1000;

    scoreDetails.part_2![i] = {
      correct_count: correctCount,
      score: scoreEarned,
      details: subDetails,
    };

    totalScore += scoreEarned;
    maxScore += p2BasePerQuestion;
  }

  // 3. Chấm Phần III (Trả lời ngắn - Chia đều điểm)
  const p3Unit = p3Count > 0 ? p3TotalScore / p3Count : 0;
  for (let i = 1; i <= p3Count; i++) {
    const studentAns = answers.part_3?.[i] || '';
    const correctAns = keys.part_3?.[i] || '';
    const isCorrect = matchShortAnswer(studentAns, correctAns);
    const score = isCorrect ? p3Unit : 0;

    scoreDetails.part_3![i] = {
      is_correct: isCorrect,
      score: Math.round(score * 1000) / 1000,
      student_ans: studentAns,
      key: correctAns,
    };

    if (isCorrect) totalScore += score;
    maxScore += p3Unit;
  }

  return {
    totalScore: Math.round(totalScore * 100) / 100,
    maxScore: Math.round(maxScore * 100) / 100,
    scoreDetails,
  };
}
