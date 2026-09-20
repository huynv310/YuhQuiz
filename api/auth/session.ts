import { Req, Res, guard, supabaseServer, setRefreshCookie, publicSession } from '../_lib/bff';

/**
 * Nhận nuôi phiên từ luồng OAuth (Google): trình duyệt vừa đổi code lấy session,
 * gửi refresh token lên đây MỘT lần để chuyển vào cookie httpOnly.
 */
export default async function handler(req: Req, res: Res) {
  if (!guard(req, res)) return;
  const { refresh_token } = req.body || {};
  if (typeof refresh_token !== 'string' || !refresh_token) {
    return res.status(400).json({ error: 'Thiếu refresh_token' });
  }
  try {
    const { data, error } = await supabaseServer().auth.refreshSession({ refresh_token });
    if (error || !data.session) return res.status(401).json({ error: 'Refresh token không hợp lệ' });
    setRefreshCookie(req, res, data.session.refresh_token);
    return res.status(200).json(publicSession(data.session, data.user));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Lỗi máy chủ' });
  }
}
