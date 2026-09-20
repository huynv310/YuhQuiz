import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

/** Bật khi đã deploy kèm /api/auth/* (Vercel). Tắt ở local `vite dev` → dùng localStorage mặc định. */
export const USE_BFF = import.meta.env.VITE_USE_BFF === 'true';

/**
 * Storage cho chế độ BFF: token chỉ nằm trong RAM (mất khi F5, an toàn trước XSS).
 * Riêng PKCE code-verifier của OAuth phải sống qua lần redirect nên để ở sessionStorage
 * (không phải token đăng nhập, chỉ dùng 1 lần).
 */
const mem = new Map<string, string>();
const bffStorage = {
  getItem: (k: string) => {
    if (k.includes('code-verifier')) {
      try { return sessionStorage.getItem(k); } catch { return null; }
    }
    return mem.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (k.includes('code-verifier')) {
      try { sessionStorage.setItem(k, v); } catch { /* bỏ qua */ }
    } else {
      mem.set(k, v);
    }
  },
  removeItem: (k: string) => {
    if (k.includes('code-verifier')) {
      try { sessionStorage.removeItem(k); } catch { /* bỏ qua */ }
    } else {
      mem.delete(k);
    }
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  USE_BFF
    ? { auth: { storage: bffStorage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }
    : undefined,
);
