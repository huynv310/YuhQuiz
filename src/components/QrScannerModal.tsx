import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera } from 'lucide-react';

interface Props {
  onClose: () => void;
  /** Gọi 1 lần duy nhất khi quét được mã QR, trả về nguyên văn nội dung mã. */
  onDetect: (rawText: string) => void;
}

/** Mở camera sau, quét liên tục bằng jsQR cho tới khi tìm thấy mã QR. */
export const QrScannerModal: React.FC<Props> = ({ onClose, onDetect }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;

    function tick() {
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result?.data) {
          onDetectRef.current(result.data);
          return; // dừng vòng lặp; modal cha chịu trách nhiệm đóng scanner
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
      } catch {
        if (!cancelled) setError('Không thể mở camera. Hãy cấp quyền camera cho trình duyệt hoặc nhập mã thủ công.');
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

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
        {error ? (
          <p className="text-xs text-rose-600 py-8">{error}</p>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
            <div className="absolute inset-6 border-2 border-white/70 rounded-2xl pointer-events-none" />
          </div>
        )}
        <p className="text-xs text-gray-500 mt-3">Đưa mã QR giáo viên chiếu vào khung hình</p>
      </div>
    </div>
  );
};
