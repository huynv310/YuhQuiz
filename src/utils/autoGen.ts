export type Part = 1 | 2 | 3;

export interface MatrixRow {
  part: Part;
  tag: string; // #hashtag; rỗng = bất kỳ
  difficulty: number; // 1..4
  count: number;
}

export interface BankQuestion {
  id: string;
  topic_tags?: string[];
  solution_files?: any[];
  difficulty: number;
  part?: number; // thiếu = phần 1 (dữ liệu cũ)
  [k: string]: any;
}

/** Fisher-Yates (rng có thể tiêm vào để test). */
export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Chọn ngẫu nhiên theo ma trận (#tag × mức độ × số câu); không trùng câu giữa các dòng. */
export function pickRandomByMatrix<T extends BankQuestion>(
  bank: T[],
  matrix: MatrixRow[],
  rng: () => number = Math.random,
): { questions: T[] } | { error: string } {
  const used = new Set<string>();
  const out: T[] = [];
  for (const row of matrix) {
    const pool = shuffle(
      bank.filter(q => (q.part ?? 1) === row.part && (!row.tag || (q.topic_tags || []).includes(row.tag)) && q.difficulty === row.difficulty && !used.has(q.id)),
      rng,
    );
    if (pool.length < row.count) {
      return { error: `Phần ${row.part} · ${row.tag ? `#${row.tag} ` : ""}mức ${row.difficulty} chỉ còn ${pool.length}/${row.count} câu.` };
    }
    for (const q of pool.slice(0, row.count)) {
      used.add(q.id);
      out.push(q);
    }
  }
  return { questions: out };
}

export const PART_TITLES: Record<Part, string> = {
  1: 'Trắc nghiệm 4 lựa chọn',
  2: 'Trắc nghiệm Đúng / Sai',
  3: 'Trả lời ngắn',
};
const DEFAULT_PART_SCORE: Record<Part, number> = { 1: 3, 2: 4, 3: 3 };

/** Đáp án phần 2 lưu dạng 'TFFT' (ý a,b,c,d) → {a:true,b:false,c:false,d:true} */
export function parsePart2Key(key: string): Record<string, boolean> {
  const k = (key || '').toUpperCase();
  return Object.fromEntries(['a', 'b', 'c', 'd'].map((sub, i) => [sub, k[i] === 'T']));
}

/** Đáp án phần 3: chuẩn hóa dấu phẩy thập phân thành dấu chấm. */
export function normalizePart3Key(key: string): string {
  return (key || '').trim().replace(',', '.');
}

export interface AssembledExam {
  sections: { id: string; title: string; question_count: number; total_score: number }[];
  ordered: BankQuestion[];
  keys: { part_1_keys: Record<number, string>; part_2_keys: Record<number, Record<string, boolean>>; part_3_keys: Record<number, string> };
  solutions: Record<number, { text: string; files: any[] }>;
}

/**
 * Lắp các câu đã chọn thành đề: sắp theo phần I→II→III (giữ thứ tự chọn trong mỗi phần),
 * đánh số liên tục, chia thang 10 điểm theo tỉ lệ 3:4:3 cho các phần có mặt.
 */
export function assembleExam(picked: BankQuestion[]): AssembledExam {
  const byPart = (p: Part) => picked.filter(q => (q.part ?? 1) === p);
  const parts: Part[] = [1, 2, 3];
  const weightSum = parts.filter(p => byPart(p).length).reduce((a, p) => a + DEFAULT_PART_SCORE[p], 0) || 1;

  const sections = parts.map(p => ({
    id: `part_${p}`,
    title: PART_TITLES[p],
    question_count: byPart(p).length,
    total_score: byPart(p).length ? Math.round((10 * DEFAULT_PART_SCORE[p] / weightSum) * 100) / 100 : 0,
  }));

  const keys: AssembledExam['keys'] = { part_1_keys: {}, part_2_keys: {}, part_3_keys: {} };
  const solutions: AssembledExam['solutions'] = {};
  const ordered: BankQuestion[] = [];
  parts.forEach(p => {
    byPart(p).forEach((q, i) => {
      const n = i + 1; // số thứ tự trong phần (server chấm theo số câu trong từng phần)
      if (p === 1) keys.part_1_keys[n] = q.correct_key;
      if (p === 2) keys.part_2_keys[n] = parsePart2Key(q.correct_key);
      if (p === 3) keys.part_3_keys[n] = normalizePart3Key(q.correct_key);
      ordered.push(q);
      solutions[ordered.length] = { text: q.solution_text || '', files: q.solution_files || [] };
    });
  });
  return { sections, ordered, keys, solutions };
}
