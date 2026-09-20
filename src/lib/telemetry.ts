import localforage from 'localforage';

/**
 * Telemetry hậu kiểm (không dùng WebSocket): ghi sự kiện vào IndexedDB (localforage),
 * gửi 1 lần duy nhất kèm bài nộp. Giới hạn 500 sự kiện để không phình payload.
 */
export interface TelemetryEvent {
  t: number;        // epoch ms
  type: string;     // 'tab_hidden' | 'blur' | 'resize' | 'fullscreen_exit' | 'shortcut' | ...
  reason: string;
  away?: number;    // số giây rời màn hình
}

const MAX_EVENTS = 500;
const store = localforage.createInstance({ name: 'yuhquiz', storeName: 'telemetry' });
const keyOf = (examId: string, token: string) => `${examId}_${token}`;

// Hàng đợi tuần tự để các lần ghi liên tiếp không ghi đè nhau
let chain: Promise<unknown> = Promise.resolve();

export function logTelemetry(examId: string, token: string, ev: Omit<TelemetryEvent, 't'>): Promise<void> {
  if (!examId || !token) return Promise.resolve();
  const next = chain.then(async () => {
    const key = keyOf(examId, token);
    const list = ((await store.getItem<TelemetryEvent[]>(key)) || []).slice(-(MAX_EVENTS - 1));
    list.push({ t: Date.now(), ...ev });
    await store.setItem(key, list);
  }).catch(() => undefined);
  chain = next;
  return next.then(() => undefined);
}

export async function readTelemetry(examId: string, token: string): Promise<TelemetryEvent[]> {
  try {
    await chain;
    return (await store.getItem<TelemetryEvent[]>(keyOf(examId, token))) || [];
  } catch {
    return [];
  }
}

export async function clearTelemetry(examId: string, token: string): Promise<void> {
  try {
    await store.removeItem(keyOf(examId, token));
  } catch { /* bỏ qua */ }
}
