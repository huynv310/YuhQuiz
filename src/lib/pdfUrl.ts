const SUPABASE_PDF_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/exam-pdfs\/exams\/([^/?#]+)$/i;

// Trên domain chính thức, đề PDF đi qua /pdf/* (rewrite trong vercel.json) để CDN của Vercel cache,
// tránh mỗi lượt xem đều tốn egress Supabase. Nơi khác (localhost, preview) giữ nguyên URL gốc.
export function toCachedPdfUrl(url: string): string {
  if (typeof window === 'undefined' || window.location.hostname !== 'yuhquiz.id.vn') return url;
  const m = SUPABASE_PDF_RE.exec(url);
  return m ? `${window.location.origin}/pdf/${m[1]}` : url;
}
