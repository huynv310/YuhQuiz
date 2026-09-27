/**
 * Cứu hộ mất kết nối.
 *  - Học sinh: bài làm dở luôn được giữ trong máy (localStorage). Khi có mạng → "Nộp lại"; nếu không nộp được
 *    (hết giờ, đổi máy...) → "Xuất file .yuhquiz" gửi giáo viên. Học sinh cũng có thể nhập lại file của chính mình.
 *  - Giáo viên: "Nhập file cứu hộ" ở từng đề (RescueImportModal) → server TỰ giải mã + xác minh chữ ký bằng
 *    rescue_secret lưu ở dòng submissions (được cấp lúc start_attempt), rồi chấm lại bằng đáp án gốc.
 *
 * File .yuhquiz xuất ra được MÃ HÓA (AES-256-CBC) và KÝ (HMAC-SHA256) bằng rescue_secret của phiên thi —
 * secret này không lộ ra ngoài (chỉ trả về 1 lần qua RPC start_attempt, không đọc lại được qua SELECT).
 * Sửa file bằng tay (dù chỉ 1 byte) sẽ làm sai chữ ký; server phát hiện và tự chấm 0 điểm + gắn cờ
 * flagged_fraud thay vì âm thầm từ chối, để giáo viên biết bài này đáng ngờ.
 */
import { supabase } from './supabase';

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
  /** Cấp bởi start_attempt(), dùng để mã hóa/ký file xuất. Không tồn tại nếu chưa có mạng lần nào. */
  rescueSecret?: string;
}

export interface EncryptedRescueFile {
  v: 2;
  examId: string;
  sessionToken: string;
  studentName: string;
  className: string;
  iv: string;
  ct: string;
  mac: string;
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

// ---- Mã hóa/ký (AES-256-CBC + HMAC-SHA256, khớp thuật toán teacher_import_rescue() dùng pgcrypto) ----

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
async function deriveKey(secret: string, purpose: 'enc' | 'mac'): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${purpose}|${secret}`));
}
function aad(sessionToken: string, studentName: string, className: string): string {
  return `${sessionToken}|${studentName}|${className}`;
}

/** Học sinh lấy lại rescue_secret của CHÍNH MÌNH cho phiên này (đổi máy, hoặc xuất bản sao bài
 *  đã nộp) — server chỉ trả về đúng chủ sở hữu, cache lại vào máy này sau khi lấy được. */
export async function fetchOwnRescueSecret(sessionToken: string): Promise<string | null> {
  try {
    const { data } = await supabase.rpc('student_fetch_rescue_secret', { p_session_token: sessionToken });
    if (typeof data === 'string' && data) {
      const prev = readRescue(sessionToken);
      if (prev) saveRescue({ ...prev, rescueSecret: data });
      return data;
    }
  } catch { /* noop */ }
  return null;
}

/** Ném lỗi nếu chưa có rescueSecret (chưa từng kết nối được máy chủ lần nào). */
export async function encryptRescueFile(rec: RescueRecord): Promise<EncryptedRescueFile> {
  if (!rec.rescueSecret) rec = { ...rec, rescueSecret: (await fetchOwnRescueSecret(rec.sessionToken)) || undefined };
  if (!rec.rescueSecret) throw new Error('Chưa sẵn sàng xuất file — hãy đợi vài giây để hệ thống đồng bộ rồi thử lại.');
  const payload = { answers: rec.answers, cheatCount: rec.cheatCount, totalAwaySecs: rec.totalAwaySecs, examTitle: rec.examTitle, timestamp: rec.timestamp };
  const plainBytes = new TextEncoder().encode(JSON.stringify(payload));
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encKey = await crypto.subtle.importKey('raw', await deriveKey(rec.rescueSecret, 'enc'), 'AES-CBC', false, ['encrypt']);
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, encKey, plainBytes);
  const a = aad(rec.sessionToken, rec.studentName || '', rec.className || '');
  const macInput = new Uint8Array(iv.length + ctBuf.byteLength + a.length);
  macInput.set(iv, 0);
  macInput.set(new Uint8Array(ctBuf), iv.length);
  macInput.set(new TextEncoder().encode(a), iv.length + ctBuf.byteLength);
  const macKey = await crypto.subtle.importKey('raw', await deriveKey(rec.rescueSecret, 'mac'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const macBuf = await crypto.subtle.sign('HMAC', macKey, macInput);
  return {
    v: 2, examId: rec.examId, sessionToken: rec.sessionToken,
    studentName: rec.studentName || '', className: rec.className || '',
    iv: bufToB64(iv.buffer), ct: bufToB64(ctBuf), mac: bufToB64(macBuf),
  };
}

/** Giải mã trên máy học sinh — dùng rescueSecret đã cache, hoặc tự lấy lại qua RPC nếu học sinh
 *  đang đăng nhập đúng tài khoản chủ bài làm này (đổi máy vẫn mở được). Trả về null nếu sai chữ
 *  ký (file bị sửa đổi) hoặc không lấy được secret (không phải chủ bài làm / chưa từng có mạng). */
export async function decryptRescueFileLocally(file: EncryptedRescueFile): Promise<RescueRecord | null> {
  const secret = readRescue(file.sessionToken)?.rescueSecret || (await fetchOwnRescueSecret(file.sessionToken));
  if (!secret) return null;
  const a = aad(file.sessionToken, file.studentName, file.className);
  const iv = b64ToBuf(file.iv);
  const ct = b64ToBuf(file.ct);
  const macInput = new Uint8Array(iv.length + ct.length + a.length);
  macInput.set(iv, 0);
  macInput.set(ct, iv.length);
  macInput.set(new TextEncoder().encode(a), iv.length + ct.length);
  const macKey = await crypto.subtle.importKey('raw', await deriveKey(secret, 'mac'), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', macKey, b64ToBuf(file.mac) as BufferSource, macInput);
  if (!ok) return null;
  const encKey = await crypto.subtle.importKey('raw', await deriveKey(secret, 'enc'), 'AES-CBC', false, ['decrypt']);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv as BufferSource }, encKey, ct as BufferSource);
    const payload = JSON.parse(new TextDecoder().decode(plainBuf));
    return {
      examId: file.examId, sessionToken: file.sessionToken, studentName: file.studentName, className: file.className,
      answers: payload.answers || {}, cheatCount: Number(payload.cheatCount) || 0, totalAwaySecs: Number(payload.totalAwaySecs) || 0,
      examTitle: payload.examTitle, timestamp: Number(payload.timestamp) || Date.now(), rescueSecret: secret,
    };
  } catch { return null; }
}

export async function downloadRescue(rec: RescueRecord) {
  const file = await encryptRescueFile(rec);
  const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Cuu_ho_${(rec.studentName || 'hs').replace(/\s+/g, '_')}_${rec.examId.slice(0, 8)}.yuhquiz`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Đọc + kiểm tra file .yuhquiz mã hóa cho luồng học sinh tự nhập lại file của mình (cùng máy).
 *  Ném lỗi tiếng Việt nếu hỏng/không đúng định dạng/không giải mã được trên máy này. */
export async function parseRescueFile(file: File): Promise<RescueRecord> {
  let j: any;
  try { j = JSON.parse(await file.text()); } catch { throw new Error('File không đọc được'); }
  if (j.v !== 2) throw new Error('File không đúng định dạng (hãy xuất lại file mới)');
  if (typeof j.sessionToken !== 'string' || !UUID_RE.test(j.sessionToken)) throw new Error('Thiếu sessionToken hợp lệ');
  const rec = await decryptRescueFileLocally(j as EncryptedRescueFile);
  if (!rec) throw new Error('Không mở được file này (không phải bài của tài khoản đang đăng nhập, hoặc file đã bị sửa đổi) — hãy gửi file cho giáo viên để nhập cứu hộ, máy chủ sẽ tự xác minh');
  return rec;
}
