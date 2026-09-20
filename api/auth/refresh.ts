import { Req, Res, guard, supabaseServer, setRefreshCookie, clearRefreshCookie, readRefreshCookie, publicSession } from '../_lib/bff';

/** Đổi refresh token trong cookie lấy access token mới (xoay vòng refresh token). */
export default async function handler(req: Req, res: Res) {
  if (!guard(req, res)) return;
  const token = readRefreshCookie(req);
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    const { data, error } = await supabaseServer().auth.refreshSession({ refresh_token: token });
    if (error || !data.session) {
      clearRefreshCookie(req, res);
      return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' });
    }
    setRefreshCookie(req, res, data.session.refresh_token);
    return res.status(200).json(publicSession(data.session, data.user));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Lỗi máy chủ' });
  }
}
