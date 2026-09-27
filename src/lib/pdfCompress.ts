// Nén PDF phía trình duyệt: dựng từng trang thành JPEG rồi đóng gói lại thành PDF.
// Thử các nấc chất lượng từ cao xuống thấp, dừng ở nấc đầu tiên đạt dung lượng mục tiêu;
// nấc thấp nhất vẫn đủ đọc rõ đề (110 dpi). Đánh đổi: chữ thành ảnh nên không chọn/copy được.

const LADDER = [
  { dpi: 150, quality: 0.78 },
  { dpi: 130, quality: 0.7 },
  { dpi: 110, quality: 0.62 },
];
const MAX_SIDE_PX = 2200;

interface PageImage { jpeg: Uint8Array; pxW: number; pxH: number; ptW: number; ptH: number }

const enc = new TextEncoder();

export function buildPdfFromJpegs(pages: PageImage[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (d: Uint8Array | string) => {
    const b = typeof d === 'string' ? enc.encode(d) : d;
    chunks.push(b);
    length += b.length;
  };
  const beginObj = (n: number) => { offsets[n] = length; push(`${n} 0 obj\n`); };

  // Đánh số: 1 = Catalog, 2 = Pages, mỗi trang i dùng 3 object: Page, Image, Content
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  beginObj(1); push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  beginObj(2); push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  pages.forEach((p, i) => {
    const pageN = 3 + i * 3, imgN = pageN + 1, contN = pageN + 2;
    const w = p.ptW.toFixed(2), h = p.ptH.toFixed(2);
    beginObj(pageN);
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imgN} 0 R >> >> /Contents ${contN} 0 R >>\nendobj\n`);
    beginObj(imgN);
    push(`<< /Type /XObject /Subtype /Image /Width ${p.pxW} /Height ${p.pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push('\nendstream\nendobj\n');
    const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    beginObj(contN);
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  });

  const total = 3 + pages.length * 3;
  const xrefPos = length;
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(xref + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

async function renderPages(pdf: any, dpi: number, quality: number, onPage: (n: number) => void): Promise<PageImage[]> {
  const pages: PageImage[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const base = page.getViewport({ scale: 1 });
    let scale = dpi / 72;
    scale = Math.min(scale, MAX_SIDE_PX / Math.max(base.width, base.height));
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob: Blob = await new Promise((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob thất bại'))), 'image/jpeg', quality));
    pages.push({
      jpeg: new Uint8Array(await blob.arrayBuffer()),
      pxW: canvas.width, pxH: canvas.height, ptW: base.width, ptH: base.height,
    });
    canvas.width = canvas.height = 0;
    page.cleanup();
    onPage(n);
  }
  return pages;
}

/** Trả về File đã nén, hoặc null nếu không nén được / không đáng (kết quả không nhỏ hơn bản gốc ≥ 15%). */
export async function compressPdf(
  file: File,
  targetBytes: number,
  onProgress?: (msg: string) => void,
): Promise<File | null> {
  const pdfjs: any = await import('pdfjs-dist');
  const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let best: Uint8Array | null = null;

  for (const step of LADDER) {
    const pages = await renderPages(pdf, step.dpi, step.quality, n =>
      onProgress?.(`Đang tối ưu dung lượng... trang ${n}/${pdf.numPages} (${step.dpi} dpi)`));
    const out = buildPdfFromJpegs(pages);
    if (!best || out.length < best.length) best = out;
    if (out.length <= targetBytes) break;
  }
  await pdf.destroy();

  if (!best || best.length > file.size * 0.85) return null;
  return new File([best as BlobPart], file.name, { type: 'application/pdf' });
}
