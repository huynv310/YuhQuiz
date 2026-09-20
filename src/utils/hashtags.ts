/** "#tích-phân #diện-tích, đạo-hàm" → ['tích-phân','diện-tích','đạo-hàm']. Tối đa 10 tag, mỗi tag ≤ 30 ký tự, không trùng. */
export function parseHashtags(input: string): string[] {
  const out: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const t = raw.replace(/^#+/, '').trim().toLowerCase();
    if (!t || t.length > 30 || out.includes(t)) continue;
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}
