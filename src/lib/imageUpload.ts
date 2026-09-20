import { supabase } from './supabase';

export const QUESTION_BUCKET = 'question-images';
const MAX_WIDTH = 1000;
const WEBP_QUALITY = 0.75;

/** Thu nhỏ canvas về tối đa MAX_WIDTH để mỗi ảnh chỉ ~30-80KB (tiết kiệm 1GB Storage). */
export function downscale(src: HTMLCanvasElement, maxWidth = MAX_WIDTH): HTMLCanvasElement {
  if (src.width <= maxWidth) return src;
  const ratio = maxWidth / src.width;
  const out = document.createElement('canvas');
  out.width = maxWidth;
  out.height = Math.round(src.height * ratio);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

export function canvasToWebp(canvas: HTMLCanvasElement, quality = WEBP_QUALITY): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Không thể nén ảnh sang WebP'))),
      'image/webp',
      quality,
    );
  });
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/** Đường dẫn lưu trong DB là tương đối → đổi nhà cung cấp lưu trữ chỉ cần sửa hàm này. */
export function getQuestionImageUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return '';
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return supabase.storage.from(QUESTION_BUCKET).getPublicUrl(pathOrUrl).data.publicUrl;
}

/** Nén → WebP → upload (tên file theo hash nội dung, cache immutable). Trả về path tương đối. */
export async function uploadQuestionImage(userId: string, canvas: HTMLCanvasElement): Promise<string> {
  const blob = await canvasToWebp(downscale(canvas));
  if (blob.size > 500 * 1024) throw new Error('Ảnh sau nén vẫn > 500KB, hãy cắt vùng nhỏ hơn.');
  const path = `${userId}/${await sha256Hex(blob)}.webp`;
  const { error } = await supabase.storage
    .from(QUESTION_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  // Trùng nội dung (đã upload trước đó) không phải lỗi
  if (error && !/exists|Duplicate|409/i.test(`${error.message} ${(error as any).statusCode}`)) throw error;
  return path;
}

export interface SolutionFile { path: string; type: 'image' | 'pdf'; name: string }
export const MAX_SOLUTION_FILES = 5;
const MAX_PDF_BYTES = 2 * 1024 * 1024;

async function putBlob(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from(QUESTION_BUCKET)
    .upload(path, blob, { contentType, cacheControl: '31536000', upsert: false });
  if (error && !/exists|Duplicate|409/i.test(`${error.message} ${(error as any).statusCode}`)) throw error;
}

/** Ảnh → thu nhỏ + WebP; PDF → giữ nguyên (≤ 2 MB). Lưu trong <uid>/sol/. */
export async function uploadSolutionFile(userId: string, file: File): Promise<SolutionFile> {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) throw new Error(`"${file.name}" lớn hơn 2 MB.`);
    const path = `${userId}/sol/${await sha256Hex(file)}.pdf`;
    await putBlob(path, file, 'application/pdf');
    return { path, type: 'pdf', name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error(`"${file.name}" không phải ảnh hoặc PDF.`);
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width; canvas.height = bmp.height;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0);
  const blob = await canvasToWebp(downscale(canvas));
  if (blob.size > 500 * 1024) throw new Error(`Ảnh "${file.name}" vẫn > 500 KB sau khi nén.`);
  const path = `${userId}/sol/${await sha256Hex(blob)}.webp`;
  await putBlob(path, blob, 'image/webp');
  return { path, type: 'image', name: file.name };
}
