/**
 * Canvas Stitcher: khâu dọc nhiều vùng cắt (vd: cuối trang 1 + đầu trang 2)
 * thành một ảnh duy nhất cho câu hỏi bị đứt trang.
 */
export function stitchVertical(pieces: HTMLCanvasElement[], gap = 0): HTMLCanvasElement {
  if (pieces.length === 0) throw new Error('Chưa có vùng nào để ghép');
  const width = Math.max(...pieces.map(p => p.width));
  const height = pieces.reduce((sum, p) => sum + p.height, 0) + gap * (pieces.length - 1);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  let y = 0;
  for (const p of pieces) {
    ctx.drawImage(p, 0, y);
    y += p.height + gap;
  }
  return out;
}

export function cropCanvas(src: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  out.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}
