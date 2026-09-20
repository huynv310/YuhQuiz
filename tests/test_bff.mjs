// Kiểm thử các handler /api/auth/* với Supabase giả
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';

async function load(name) {
  const out = await build({
    entryPoints: [path.join(here, `../api/auth/${name}.ts`)], bundle: true, format: 'esm', write: false, platform: 'node',
    alias: { '@supabase/supabase-js': path.join(here, 'fake_supabase.mjs') },
  });
  return (await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))).default;
}
const H = { login: await load('login'), refresh: await load('refresh'), logout: await load('logout'), session: await load('session') };

function call(handler, { method = 'POST', headers = {}, body } = {}) {
  globalThis.__sb = { calls: [], rl: globalThis.__rl ||= new Map(), rpcDown: globalThis.__rpcDown };
  const res = { code: 200, headers: {}, body: undefined,
    status(c) { this.code = c; return this; }, json(b) { this.body = b; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end() {} };
  const req = { method, headers: { host: 'app.example.com', 'x-forwarded-proto': 'https', 'x-requested-with': 'yuhquiz', origin: 'https://app.example.com', ...headers }, body };
  return handler(req, res).then(() => ({ res, calls: globalThis.__sb.calls }));
}
const good = { email: 'a@b.c', password: 'good' };

// --- guard / CSRF ---
assert.equal((await call(H.login, { method: 'GET', body: good })).res.code, 405);
assert.equal((await call(H.login, { headers: { origin: 'https://evil.com' }, body: good })).res.code, 403, 'origin khác');
assert.equal((await call(H.login, { headers: { origin: 'null' }, body: good })).res.code, 403, 'Origin: null không được làm sập handler');
assert.equal((await call(H.login, { headers: { 'x-requested-with': '' }, body: good })).res.code, 403, 'thiếu header');
const noOrigin = await call(H.login, { headers: { origin: '' }, body: good });
assert.equal(noOrigin.res.code, 200, 'không có Origin (same-origin fetch cũ) vẫn qua nhờ header tùy biến');

// --- login ---
const ok = await call(H.login, { body: good });
assert.equal(ok.res.code, 200);
const cookie = ok.res.headers['set-cookie'];
assert.match(cookie, /^yq_rt=RT1/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
assert.match(cookie, /Secure/); assert.match(cookie, /Path=\/api\/auth/);
assert.ok(!JSON.stringify(ok.res.body).includes('RT1'), 'refresh token KHÔNG được xuất hiện trong body');
assert.equal(ok.res.body.access_token, 'AT1');
assert.equal(ok.res.headers['cache-control'], 'no-store');
const bad = await call(H.login, { body: { email: 'a@b.c', password: 'nope' } });
assert.equal(bad.res.code, 401); assert.equal(bad.res.headers['set-cookie'], undefined, 'sai mật khẩu không được set cookie');
assert.equal((await call(H.login, { body: { email: 'a@b.c' } })).res.code, 400);
assert.equal((await call(H.login, { body: { email: 123, password: {} } })).res.code, 400);
const local = await call(H.login, { headers: { host: 'localhost:3000', 'x-forwarded-proto': '', origin: 'http://localhost:3000' }, body: good });
assert.ok(!/Secure/.test(local.res.headers['set-cookie']), 'localhost http: không đặt Secure (nếu đặt, cookie không lưu được)');

// --- refresh ---
assert.equal((await call(H.refresh, {})).res.code, 401, 'không có cookie');
const rf = await call(H.refresh, { headers: { cookie: 'other=1; yq_rt=RT1' } });
assert.equal(rf.res.code, 200); assert.match(rf.res.headers['set-cookie'], /^yq_rt=RT2/, 'xoay vòng refresh token');
assert.ok(!JSON.stringify(rf.res.body).includes('RT2'));
const dead = await call(H.refresh, { headers: { cookie: 'yq_rt=DEAD' } });
assert.equal(dead.res.code, 401); assert.match(dead.res.headers['set-cookie'], /Max-Age=0/, 'token chết → xóa cookie');

// --- logout ---
const lo = await call(H.logout, { headers: { cookie: 'yq_rt=RT1' } });
assert.equal(lo.res.code, 200); assert.match(lo.res.headers['set-cookie'], /Max-Age=0/);
assert.ok(lo.calls.some(c => c[0] === 'signOut'), 'phải thu hồi phiên phía Supabase');
const lo2 = await call(H.logout, {});
assert.equal(lo2.res.code, 200, 'logout không cookie vẫn OK');

// --- session (nhận nuôi OAuth) ---
assert.equal((await call(H.session, { body: {} })).res.code, 400);
assert.equal((await call(H.session, { body: { refresh_token: 'DEAD' } })).res.code, 401);
const ad = await call(H.session, { body: { refresh_token: 'OAUTH' } });
assert.equal(ad.res.code, 200); assert.match(ad.res.headers['set-cookie'], /^yq_rt=RT2/);
assert.equal((await call(H.session, { headers: { origin: 'https://evil.com' }, body: { refresh_token: 'OAUTH' } })).res.code, 403);

// --- giới hạn tần suất ---
globalThis.__rl = new Map();
const badBody = { email: 'victim@x.com', password: 'wrong' };
const ipA = { 'x-forwarded-for': '1.1.1.1, 10.0.0.1' }, ipB = { 'x-forwarded-for': '2.2.2.2' };
for (let i = 0; i < 5; i++) assert.equal((await call(H.login, { headers: ipA, body: badBody })).res.code, 401, `lần ${i + 1} sai mật khẩu`);
const blocked = await call(H.login, { headers: ipA, body: { email: 'victim@x.com', password: 'good' } });
assert.equal(blocked.res.code, 429, 'sau 5 lần sai: chặn cả khi mật khẩu đúng');
assert.ok(Number(blocked.res.headers['retry-after']) > 0, 'có Retry-After');
assert.ok(!blocked.calls.some(c => c[0] === 'signIn'), 'bị chặn thì không gọi Supabase Auth');
assert.equal((await call(H.login, { headers: ipB, body: { email: 'victim@x.com', password: 'good' } })).res.code, 200, 'IP khác không bị ảnh hưởng (không khóa tài khoản từ xa)');
assert.equal((await call(H.login, { headers: ipA, body: { email: 'other@x.com', password: 'good' } })).res.code, 200, 'cùng IP nhưng email khác vẫn đăng nhập được');

// đăng nhập đúng xóa bộ đếm của (ip, email)
globalThis.__rl = new Map();
for (let i = 0; i < 4; i++) await call(H.login, { headers: ipA, body: badBody });
assert.equal((await call(H.login, { headers: ipA, body: { email: 'victim@x.com', password: 'good' } })).res.code, 200);
for (let i = 0; i < 4; i++) assert.equal((await call(H.login, { headers: ipA, body: badBody })).res.code, 401, 'bộ đếm đã reset sau khi đăng nhập thành công');

// một IP dò nhiều email: chặn theo IP sau 20 lần
globalThis.__rl = new Map();
for (let i = 0; i < 20; i++) await call(H.login, { headers: ipA, body: { email: `u${i}@x.com`, password: 'wrong' } });
assert.equal((await call(H.login, { headers: ipA, body: { email: 'fresh@x.com', password: 'good' } })).res.code, 429, 'IP dò 20 email khác nhau bị chặn');

// hạ tầng đếm lỗi → cho qua (fail-open)
globalThis.__rl = new Map(); globalThis.__rpcDown = true;
assert.equal((await call(H.login, { headers: ipA, body: good })).res.code, 200, 'RPC đếm hỏng vẫn cho đăng nhập');
globalThis.__rpcDown = false;

console.log('✓ test_bff: tất cả case đạt');
