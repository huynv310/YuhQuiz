import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera, ImageUp, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
  /** Gọi 1 lần duy nhất khi quét được mã lớp hợp lệ (đã trích/kiểm tra định dạng). */
  onDetect: (code: string) => void;
}

const SCAN_TIMEOUT_MS = 30_000;
/** Mã lớp: URL .../join/<mã> hoặc mã trần, 6-8 ký tự chữ/số (khớp charset sinh mã ở ClassroomModal). */
function extractClassCode(rawText: string): string | null {
  const match = rawText.trim().match(/([A-Za-z0-9]{6,8})\/?$/);
  return match ? match[1].toUpperCase() : null;
}

/** Mở camera sau, quét liên tục bằng jsQR; hoặc chọn ảnh có sẵn từ thư viện để quét. */
export const QrScannerModal: React.FC<Props> = ({ onClose, onDetect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const foundRef = useRef(false);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const showWarning = (msg: string) => {
    setWarning(msg);
    if (warningClearRef.current) clearTimeout(warningClearRef.current);
    warningClearRef.current = setTimeout(() => setWarning(null), 3000);
  };

  const handleRawDetected = (rawText: string) => {
    const code = extractClassCode(rawText);
    if (!code) {
      showWarning('Mã QR không hợp lệ — đây không phải mã lớp học của YuhQuiz.');
      return;
    }
    foundRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    onDetectRef.current(code);
  };

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;

    function tick() {
      if (foundRef.current || cancelled) return;
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          handleRawDetected(result.data);
          if (foundRef.current) return; // hợp lệ: dừng vòng lặp, modal cha đóng scanner
          // không hợp lệ: đã hiện cảnh báo, tiếp tục quét bình thường
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
        timeoutRef.current = setTimeout(() => {
          if (!foundRef.current && !cancelled) setTimedOut(true);
        }, SCAN_TIMEOUT_MS);
      } catch {
        if (!cancelled) setCameraError('Không thể mở camera. Hãy cấp quyền camera cho trình duyệt hoặc chọn ảnh/nhập mã thủ công.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningClearRef.current) clearTimeout(warningClearRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (!result?.data) {
        showWarning('Không tìm thấy mã QR trong ảnh này, hãy thử ảnh khác.');
        return;
      }
      handleRawDetected(result.data);
    } catch {
      showWarning('Không đọc được file ảnh, hãy thử lại.');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center yq-overlay p-4">
      <div className="glass-panel rounded-3xl max-w-sm w-full p-5 shadow-2xl relative text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-extrabold text-lg text-gray-900 mb-3 flex items-center justify-center gap-2">
          <Camera className="w-5 h-5" /> Quét mã QR lớp học
        </h3>

        {cameraError ? (
          <p className="text-xs text-rose-600 py-8">{cameraError}</p>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-6 border-2 border-white/70 rounded-2xl pointer-events-none" />
          </div>
        )}

        {warning && (
          <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}
        {timedOut && !warning && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-xs text-amber-700 text-left">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Chưa tìm thấy mã QR sau 30 giây. Hãy đưa mã lại gần camera hơn, hoặc chọn ảnh/nhập mã thủ công.</span>
          </div>
        )}

        <p className="text-xs text-gray-500 mt-3">Đưa mã QR giáo viên chiếu vào khung hình</p>

        <label className="mt-3 inline-flex items-center gap-2 px-3 py-2 border-2 border-gray-200 hover:border-primary rounded-xl cursor-pointer text-xs font-bold text-gray-700 transition-all">
          <ImageUp className="w-4 h-4" />
          <span>Chọn ảnh có mã QR từ thư viện</span>
          <input type="file" accept="image/*" className="hidden" onChange={handlePickImage} />
        </label>
      </div>
    </div>
  );
};
