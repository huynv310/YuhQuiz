// Load-test nhắm vào production: gọi RPC public.server_now() (anon-callable, không cần đăng
// nhập) đồng thời với N request tăng dần, đo latency + tỉ lệ lỗi mỗi đợt. Đây đúng là request
// mọi học sinh gọi lúc mở đề (StudentExamRoom init) — dùng để đo ngưỡng connection pool thật
// của Supabase Free (60 direct / 200 qua pooler) mà không tạo tài khoản hay dữ liệu giả nào.
//
// Chạy: node scripts/loadtest_server_now.mjs
import { readFileSync } from 'fs';

function loadEnv() {
  const txt = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnv();
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error('Thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY trong .env');

const ENDPOINT = `${URL_}/rest/v1/rpc/server_now`;

async function oneCall() {
  const start = performance.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    const ms = performance.now() - start;
    if (!res.ok) return { ok: false, ms, status: res.status };
    await res.text();
    return { ok: true, ms };
  } catch (e) {
    return { ok: false, ms: performance.now() - start, status: 'network:' + e.message };
  }
}

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function runWave(n) {
  const results = await Promise.all(Array.from({ length: n }, oneCall));
  const okList = results.filter((r) => r.ok);
  const failList = results.filter((r) => !r.ok);
  const times = okList.map((r) => r.ms).sort((a, b) => a - b);
  const errorRate = failList.length / n;
  const p50 = times.length ? percentile(times, 50) : NaN;
  const p95 = times.length ? percentile(times, 95) : NaN;
  const p99 = times.length ? percentile(times, 99) : NaN;
  const sampleErrors = [...new Set(failList.slice(0, 3).map((r) => String(r.status)))];
  return { n, ok: okList.length, fail: failList.length, errorRate, p50, p95, p99, sampleErrors };
}

const WAVES = [10, 20, 40, 60, 90, 120, 160, 200, 260, 320, 400, 600, 800, 1100, 1500, 2000, 2700, 3600];
const ERROR_RATE_STOP = 0.05; // dừng khi >5% request lỗi
const P95_STOP_MS = 4000; // hoặc p95 vượt 4s (coi như không còn phản hồi tốt)

console.log(`Load-test server_now() nhắm vào: ${URL_}`);
console.log('n\tok\tfail\terr%\tp50ms\tp95ms\tp99ms');

for (const n of WAVES) {
  const r = await runWave(n);
  console.log(
    `${r.n}\t${r.ok}\t${r.fail}\t${(r.errorRate * 100).toFixed(1)}%\t${r.p50.toFixed(0)}\t${r.p95.toFixed(0)}\t${r.p99.toFixed(0)}` +
      (r.sampleErrors.length ? `\t(mẫu lỗi: ${r.sampleErrors.join(', ')})` : '')
  );
  if (r.errorRate > ERROR_RATE_STOP || r.p95 > P95_STOP_MS) {
    console.log(`\n=> Dừng tại n=${r.n}: ${r.errorRate > ERROR_RATE_STOP ? 'tỉ lệ lỗi vượt 5%' : 'p95 vượt 4s'}.`);
    break;
  }
  // nghỉ giữa các đợt để không cộng dồn lỗi từ đợt trước sang đợt sau
  await new Promise((r2) => setTimeout(r2, 1500));
}
