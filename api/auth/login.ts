import { Req, Res, guard, supabaseServer, setRefreshCookie, setSessionStartCookie, publicSession, rateKeys, rateLimitWait, rateLimitFail, rateLimitReset } from '../_lib/bff';

export default async function handler(req: Req, res: Res) {
  if (!guard(req, res)) return;
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Thiếu email hoặc mật khẩu' });
  }
  try {
    const sb = supabaseServer();
    const keys = rateKeys(req, email);
    const wait = await rateLimitWait(sb, keys);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      return res.status(429).json({ error: `Thử đăng nhập quá nhiều lần. Vui lòng thử lại sau ${Math.ceil(wait / 60)} phút.` });
    }
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.session) {
      await rateLimitFail(sb, keys);
      return res.status(401).json({ error: error?.message || 'Email hoặc mật khẩu không chính xác.' });
    }
    await rateLimitReset(sb, keys);
    setRefreshCookie(req, res, data.session.refresh_token);
    setSessionStartCookie(req, res);
    return res.status(200).json(publicSession(data.session, data.user));
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Lỗi máy chủ' });
  }
}
