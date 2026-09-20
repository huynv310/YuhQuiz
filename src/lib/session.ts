import { supabase, USE_BFF } from './supabase';

/**
 * Quản lý phiên theo mô hình BFF:
 *  - Access token: chỉ trong RAM của trình duyệt.
 *  - Refresh token: cookie httpOnly do /api/auth/* cấp, JS không đọc được.
 * Khi USE_BFF=false (local dev) mọi hàm rơi về hành vi mặc định của supabase-js.
 */

const PLACEHOLDER_REFRESH = 'bff-managed'; // supabase-js bắt buộc có trường này; không bao giờ dùng để refresh
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

interface BffSession {
  access_token: string;
  expires_at?: number;
  expires_in?: number;
  user: any;
}

async function callBff(path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'yuhquiz' },
    body: JSON.stringify(body ?? {}),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* không phải JSON */ }
  return { ok: res.ok, status: res.status, data };
}

function scheduleRefresh(expiresAt?: number) {
  if (timer) clearTimeout(timer);
  const ms = expiresAt ? Math.max(5_000, expiresAt * 1000 - Date.now() - 60_000) : 45 * 60_000;
  timer = setTimeout(() => { void refreshNow(); }, ms);
}

async function applySession(s: BffSession) {
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: PLACEHOLDER_REFRESH });
  if (error) throw error;
  scheduleRefresh(s.expires_at);
}

async function refreshNow(): Promise<boolean> {
  try {
    const r = await callBff('refresh');
    if (!r.ok) {
      if (r.status === 401) await supabase.auth.signOut({ scope: 'local' });
      return false;
    }
    await applySession(r.data);
    return true;
  } catch {
    // Mất mạng tạm thời: thử lại sau 30s, không đăng xuất
    timer = setTimeout(() => { void refreshNow(); }, 30_000);
    return false;
  }
}

/** Gọi 1 lần khi khởi động app, trước supabase.auth.getSession(). */
export async function bootSession(): Promise<void> {
  if (!USE_BFF || started) return;
  started = true;

  // Luồng OAuth: supabase-js đổi code lấy session thật → chuyển refresh token vào cookie rồi bỏ khỏi RAM
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session && session.refresh_token !== PLACEHOLDER_REFRESH) {
      const rt = session.refresh_token;
      void callBff('session', { refresh_token: rt }).then(r => {
        if (r.ok) void applySession(r.data);
      });
    }
  });

  // Nếu đang giữa luồng OAuth (?code=...) thì để supabase-js xử lý, không refresh bằng cookie
  if (new URLSearchParams(window.location.search).has('code')) return;

  await refreshNow();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void refreshNow();
  });
}

export async function signInWithPassword(email: string, password: string): Promise<{ data: { user: any }; error: Error | null }> {
  if (!USE_BFF) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data: { user: data?.user ?? null }, error };
  }
  const r = await callBff('login', { email, password });
  if (!r.ok) return { data: { user: null }, error: new Error(r.data?.error || 'Đăng nhập thất bại') };
  await applySession(r.data);
  return { data: { user: r.data.user }, error: null };
}

export async function signOutEverywhere(): Promise<void> {
  if (timer) clearTimeout(timer);
  if (USE_BFF) {
    try { await callBff('logout'); } catch { /* cookie sẽ hết hạn theo thời gian */ }
  }
  await supabase.auth.signOut({ scope: 'local' });
}
