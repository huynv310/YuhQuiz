export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mã đề 6 ký tự (0-9, A-Z); nhập thường/hoa đều được. */
export const normalizeExamKey = (s: string) => s.trim();
export const isShortId = (s: string) => /^[0-9A-Za-z]{6}$/.test(s.trim());

export function examLink(exam: { id: string; short_id?: string | null }) {
  return `${window.location.origin}/?examId=${exam.short_id || exam.id}`;
}

export const PENDING_EXAM_KEY = 'yq_pending_exam';
export const readPendingExam = (): string | null => {
  try {
    const q = new URLSearchParams(window.location.search).get('examId');
    if (q) { sessionStorage.setItem(PENDING_EXAM_KEY, q); return q; }
    return sessionStorage.getItem(PENDING_EXAM_KEY);
  } catch { return new URLSearchParams(window.location.search).get('examId'); }
};
export const clearPendingExam = () => {
  try { sessionStorage.removeItem(PENDING_EXAM_KEY); } catch { /* ignore */ }
  if (window.location.search.includes('examId')) window.history.replaceState({}, '', window.location.pathname);
};
