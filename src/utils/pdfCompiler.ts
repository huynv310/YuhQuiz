import { PDFDocument, PageSizes, StandardFonts, rgb } from 'pdf-lib';
import { supabase } from '../lib/supabase';
import { getQuestionImageUrl } from '../lib/imageUpload';

export interface CompileOptions {
  title: string;
  subject: string;
  grade: number | string;
  durationMinutes: number;
  questionImageUrls: string[];
  onProgress?: (step: string, percent: number) => void;
}

/** Chuyển đổi mọi định dạng ảnh (WebP, PNG, JPEG) thành PNG ArrayBuffer qua Canvas */
async function loadImgAsPngBytes(url: string): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Không thể khởi tạo 2D context'));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('Lỗi chuyển ảnh sang PNG'));
          blob.arrayBuffer().then(buf => {
            resolve({ bytes: new Uint8Array(buf), width: canvas.width, height: canvas.height });
          }).catch(reject);
        }, 'image/png');
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error(`Không thể tải ảnh: ${url}`));
    img.src = url;
  });
}

/**
 * Biên dịch danh sách ảnh câu hỏi từ Kho bài tập thành 1 file PDF A4 chuẩn Vector
 * Tự động phân trang, căn lề và đóng số trang.
 */
export async function compileExamPdf(options: CompileOptions): Promise<{ pdfBlob: Blob; pdfUrl: string; hash: string }> {
  const { title, subject, grade, durationMinutes, questionImageUrls, onProgress } = options;

  onProgress?.('Đang khởi tạo tài liệu PDF...', 10);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const PAGE_WIDTH = PageSizes.A4[0];   // 595.28 pt
  const PAGE_HEIGHT = PageSizes.A4[1];  // 841.89 pt
  const MARGIN_X = 40;
  const MARGIN_TOP = 40;
  const MARGIN_BOTTOM = 45;
  const USABLE_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 515.28 pt

  let currentPage = pdfDoc.addPage(PageSizes.A4);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  // Header trang đầu tiên
  const drawHeader = () => {
    currentPage.drawText('SO GIAO DUC VA DAO TAO', { x: MARGIN_X, y: currentY, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    currentPage.drawText(`KHOI: ${grade || 12} - MON: ${subject.toUpperCase()}`, { x: MARGIN_X + 260, y: currentY, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    currentY -= 16;

    currentPage.drawText(title.toUpperCase().slice(0, 50), { x: MARGIN_X, y: currentY, size: 12, font, color: rgb(0.05, 0.4, 0.25) });
    currentPage.drawText(`Thoi gian: ${durationMinutes} phut`, { x: MARGIN_X + 260, y: currentY, size: 10, font: fontRegular, color: rgb(0.3, 0.3, 0.3) });
    currentY -= 14;

    currentPage.drawLine({
      start: { x: MARGIN_X, y: currentY },
      end: { x: PAGE_WIDTH - MARGIN_X, y: currentY },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    currentY -= 20;
  };

  drawHeader();

  const total = questionImageUrls.length;
  for (let i = 0; i < total; i++) {
    const rawUrl = questionImageUrls[i];
    const fullUrl = getQuestionImageUrl(rawUrl);
    onProgress?.(`Đang xử lý câu ${i + 1}/${total}...`, Math.round(15 + (i / total) * 60));

    try {
      const { bytes, width, height } = await loadImgAsPngBytes(fullUrl);
      const img = await pdfDoc.embedPng(bytes);

      // Scale tỷ lệ vừa khít chiều rộng trang
      const scale = Math.min(1, USABLE_WIDTH / width);
      const renderWidth = width * scale;
      const renderHeight = height * scale;

      // Chiều cao nhãn câu hỏi (Câu 1, Câu 2...)
      const labelHeight = 16;
      const totalQuestionHeight = renderHeight + labelHeight + 10;

      // Nếu không đủ chỗ trên trang hiện tại -> sang trang mới
      if (currentY - totalQuestionHeight < MARGIN_BOTTOM) {
        currentPage = pdfDoc.addPage(PageSizes.A4);
        currentY = PAGE_HEIGHT - MARGIN_TOP;
      }

      // Vẽ nhãn câu hỏi
      currentPage.drawText(`Cau ${i + 1}:`, {
        x: MARGIN_X,
        y: currentY - 10,
        size: 10,
        font,
        color: rgb(0.1, 0.4, 0.6),
      });
      currentY -= labelHeight;

      // Vẽ ảnh câu hỏi
      currentPage.drawImage(img, {
        x: MARGIN_X,
        y: currentY - renderHeight,
        width: renderWidth,
        height: renderHeight,
      });

      currentY -= (renderHeight + 12);
    } catch (err) {
      console.warn(`Lỗi khi nhúng ảnh câu ${i + 1}:`, err);
    }
  }

  // Đánh số trang
  const pages = pdfDoc.getPages();
  pages.forEach((page, idx) => {
    page.drawText(`Trang ${idx + 1} / ${pages.length} - YuhQuiz`, {
      x: PAGE_WIDTH / 2 - 45,
      y: 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
  });

  onProgress?.('Đang kết xuất tệp PDF hoàn chỉnh...', 85);
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
  const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });

  // Tính SHA-256 để lưu file dedup chuẩn
  onProgress?.('Đang tải lên hệ thống lưu trữ...', 92);
  const digest = await crypto.subtle.digest('SHA-256', pdfBuffer);
  const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  const filePath = `exams/${hash}.pdf`;

  const { error: uploadErr } = await supabase.storage
    .from('exam-pdfs')
    .upload(filePath, pdfBlob, {
      cacheControl: '31536000',
      upsert: false,
      contentType: 'application/pdf',
    });

  if (uploadErr && !/exists|Duplicate|409/i.test(`${uploadErr.message} ${(uploadErr as any).statusCode}`)) {
    console.error('Không thể upload PDF lên Storage:', uploadErr);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('exam-pdfs')
    .getPublicUrl(filePath);

  onProgress?.('Hoàn tất!', 100);
  return { pdfBlob, pdfUrl: publicUrl, hash };
}
