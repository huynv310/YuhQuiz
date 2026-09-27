const SUPABASE_PDF_RE = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/exam-pdfs\/exams\/([^/?#]+)$/i;
export const PDF_CDN_ORIGIN = 'https://yuhquiz-pdf.nguyenhuy03102007.workers.dev';

// Đề PDF đi qua Cloudflare Worker (cache ở edge) để không tốn egress Supabase cho mỗi lượt xem.
// URL không thuộc bucket exam-pdfs (link Drive, v.v.) giữ nguyên.
export function toCachedPdfUrl(url: string): string {
  const m = SUPABASE_PDF_RE.exec(url);
  return m ? `${PDF_CDN_ORIGIN}/${m[1]}` : url;
}
