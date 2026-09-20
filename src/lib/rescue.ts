/**
 * Cứu hộ mất kết nối.
 *  - Học sinh: bài làm dở luôn được giữ trong máy (localStorage). Khi có mạng → "Nộp lại"; nếu không nộp được
 *    (hết giờ, đổi máy...) → "Xuất file .yuhquiz" gửi giáo viên. Học sinh cũng có thể nhập lại file của chính mình.
 *  - Giáo viên: "Nhập file cứu hộ" ở từng đề (RescueImportModal) → server chấm lại bằng đáp án gốc.
 */
export interface RescueRecord {
  examId: string;
  examTitle?: string;
  studentName: string;
  className: string;
  sessionToken: string;
  answers: any;
  cheatCount: number;
  totalAwaySecs: number;
  timestamp: number;
}

const PREFIX = 'yq_rescue_';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function saveRescue(rec: Partial<RescueRecord> & Pick<RescueRecord, 'examId' | 'sessionToken'>) {
  try {
    const prev = readRescue(rec.sessionToken);
    const next = { studentName: '', className: '', answers: {}, cheatCount: 0, totalAwaySecs: 0, ...prev, ...rec, timestamp: Date.now() };
    localStorage.setItem(PREFIX + rec.sessionToken, JSON.stringify(next));
  } catch { /* localStorage đầy/bị chặn: bỏ qua */ }
}

export function readRescue(token: string): RescueRecord | null {
  try { return JSON.parse(localStorage.getItem(PREFIX + token) || 'null'); } catch { return null; }
}

export function removeRescue(token: string) {
  try { localStorage.removeItem(PREFIX + token); } catch { /* noop */ }
}

const hasAnswers = (a: any) => ['part_1', 'part_2', 'part_3'].some(k => Object.keys(a?.[k] || {}).length > 0);

export function listRescue(): RescueRecord[] {
  const out: RescueRecord[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PREFIX)) continue;
      const r = JSON.parse(localStorage.getItem(k) || 'null');
      if (r?.examId && r.sessionToken && hasAnswers(r.answers)) out.push(r);
    }
  } catch { /* noop */ }
  return out.sort((a, b) => b.timestamp - a.timestamp);
}

export function downloadRescue(rec: RescueRecord) {
  const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cuu_ho_${(rec.studentName || 'hs').replace(/\s+/g, '_')}_${rec.examId.slice(0, 8)}.yuhquiz`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Đọc + kiểm tra file .yuhquiz; ném lỗi tiếng Việt nếu hỏng. */
export async function parseRescueFile(file: File): Promise<RescueRecord> {
  let j: any;
  try { j = JSON.parse(await file.text()); } catch { throw new Error('File không đọc được'); }
  if (typeof j.examId !== 'string') throw new Error('Thiếu mã đề');
  if (typeof j.sessionToken !== 'string' || !UUID_RE.test(j.sessionToken)) throw new Error('Thiếu sessionToken hợp lệ');
  if (!j.answers || typeof j.answers !== 'object') throw new Error('Thiếu câu trả lời');
  return {
    examId: j.examId, examTitle: j.examTitle, studentName: String(j.studentName || ''), className: String(j.className || ''),
    sessionToken: j.sessionToken, answers: j.answers, cheatCount: Number(j.cheatCount) || 0,
    totalAwaySecs: Number(j.totalAwaySecs) || 0, timestamp: Number(j.timestamp) || Date.now(),
  };
}
