import { Req, Res, guard, supabaseServer, clearRefreshCookie, readRefreshCookie } from '../_lib/bff';

export default async function handler(req: Req, res: Res) {
  if (!guard(req, res)) return;
  const token = readRefreshCookie(req);
  clearRefreshCookie(req, res);
  if (token) {
    // Thu hồi phiên phía Supabase (best-effort): nạp phiên vào client tạm rồi signOut chính phiên đó.
    // Không cần service-role key: signOut dùng access token của chính phiên.
    try {
      const sb = supabaseServer();
      const { data } = await sb.auth.refreshSession({ refresh_token: token });
      if (data.session) await sb.auth.signOut({ scope: 'local' });
    } catch { /* bỏ qua: cookie đã bị xóa */ }
  }
  return res.status(200).json({ ok: true });
}
