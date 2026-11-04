import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { stampWatermarkOnCanvas, buildAdversarialWatermarkText } from '../utils/watermark';

interface PdfCanvasViewerProps {
  url: string;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  userCode?: string;
  studentName?: string;
  examId?: string;
  onLoadSuccess?: (numPages: number) => void;
  onPageVisible?: (pageNumber: number) => void;
  className?: string;
}

interface PageMeta {
  pageNumber: number;
  width: number;
  height: number;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  url,
  zoom = 1.0,
  onZoomChange,
  userCode,
  studentName,
  examId,
  onLoadSuccess,
  onPageVisible,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<any>(null);
  const [pages, setPages] = useState<PageMeta[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Pinch-to-zoom touch gesture state
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(zoom);

  const watermarkText = React.useMemo(() => {
    return buildAdversarialWatermarkText({
      userCode,
      studentName,
      examId,
    });
  }, [userCode, studentName, examId]);

  // Load PDF document using pdfjs-dist on demand
  useEffect(() => {
    if (!url) return;
    let isCancelled = false;
    setLoading(true);
    setProgress(5);
    setError(null);
    setPages([]);

    const loadDoc = async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

        // Fetch with progress tracking
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Không tải được tệp PDF (HTTP ${res.status})`);
        }

        const contentLength = res.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
        let loadedBytes = 0;

        const reader = res.body?.getReader();
        const chunks: Uint8Array[] = [];

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loadedBytes += value.length;
              if (totalBytes > 0) {
                const pct = Math.min(90, Math.round((loadedBytes / totalBytes) * 80) + 10);
                if (!isCancelled) setProgress(pct);
              }
            }
          }
        }

        if (isCancelled) return;

        // Combine chunks
        const allBytes = new Uint8Array(loadedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          allBytes.set(chunk, offset);
          offset += chunk.length;
        }

        setProgress(95);

        const loadingTask = pdfjs.getDocument({
          data: allBytes,
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
          cMapPacked: true,
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        const numPages = doc.numPages;

        // Gather page dimensions for placeholders
        const pageMetas: PageMeta[] = [];
        for (let i = 1; i <= numPages; i++) {
          const page = await doc.getPage(i);
          const vp = page.getViewport({ scale: 1.0 });
          pageMetas.push({ pageNumber: i, width: vp.width, height: vp.height });
        }

        if (isCancelled) return;
        setPages(pageMetas);
        setLoading(false);
        setProgress(100);
        onLoadSuccess?.(numPages);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Lỗi nạp PDF:', err);
          setError(err?.message || 'Không thể hiển thị đề thi PDF.');
          setLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isCancelled = true;
      pdfDocRef.current = null;
    };
  }, [url, onLoadSuccess]);

  // Handle pinch-to-zoom for touch devices
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current && onZoomChange) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDistRef.current;
      const targetZoom = Math.min(2.5, Math.max(0.7, parseFloat((touchStartZoomRef.current * ratio).toFixed(2))));
      onZoomChange(targetZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#525659] text-white p-6 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-sm font-semibold tracking-wide">Đang tải và giải mã đề thi ({progress}%)...</p>
        <div className="w-48 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#525659] text-white p-6 space-y-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-medium text-rose-200 max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-white text-gray-900 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all shadow"
        >
          Tải lại trang
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`flex-1 overflow-y-auto overflow-x-auto bg-[#525659] p-2 sm:p-4 flex flex-col items-center select-none touch-pan-x touch-pan-y ${className}`}
    >
      <div className="w-full flex flex-col items-center space-y-4 pb-12">
        {pages.map((p) => (
          <PdfPageCanvas
            key={p.pageNumber}
            doc={pdfDocRef.current}
            meta={p}
            zoom={zoom}
            watermarkText={watermarkText}
            onVisible={() => onPageVisible?.(p.pageNumber)}
          />
        ))}
      </div>
    </div>
  );
};

interface PdfPageCanvasProps {
  doc: any;
  meta: PageMeta;
  zoom: number;
  watermarkText: string;
  onVisible?: () => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  doc,
  meta,
  zoom,
  watermarkText,
  onVisible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [rendered, setRendered] = useState<boolean>(false);

  // Virtualization: IntersectionObserver to render only visible pages (+200px threshold)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsVisible(true);
          onVisible?.();
        } else {
          // Offload far pages to prevent high RAM usage on mobile devices
          setIsVisible(false);
          setRendered(false);
          if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
          }
        }
      },
      { rootMargin: '300px 0px 300px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  // Render canvas when page becomes visible or zoom changes
  useEffect(() => {
    if (!isVisible || !doc || !canvasRef.current) return;
    let isCancelled = false;

    const render = async () => {
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }

        const page = await doc.getPage(meta.pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5); // Retina HiDPI scale
        const baseViewport = page.getViewport({ scale: zoom });
        const scaledViewport = page.getViewport({ scale: zoom * dpr });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = `${Math.floor(baseViewport.width)}px`;
        canvas.style.height = `${Math.floor(baseViewport.height)}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isCancelled) return;

        // Stamp adversarial AI-refusal watermark directly onto the canvas pixels
        stampWatermarkOnCanvas(ctx, canvas.width, canvas.height, watermarkText, {
          fontSize: Math.max(14, Math.round(canvas.width / 45)),
          opacity: 0.045, // Subtle for students, clear for OCR
        });

        setRendered(true);
      } catch (err: any) {
        // Silently ignore cancellation errors from re-zooming
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Lỗi render trang ${meta.pageNumber}:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [isVisible, doc, meta.pageNumber, zoom, watermarkText]);

  // Compute layout dimensions for smooth placeholder
  const displayWidth = Math.round(meta.width * zoom);
  const displayHeight = Math.round(meta.height * zoom);

  return (
    <div
      ref={containerRef}
      className="relative bg-white rounded-lg shadow-md transition-shadow overflow-hidden flex items-center justify-center"
      style={{
        width: `${displayWidth}px`,
        minHeight: `${displayHeight}px`,
        maxWidth: '100%',
      }}
    >
      {/* Page number badge */}
      <div className="absolute top-2 left-2 z-10 bg-slate-900/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full pointer-events-none">
        Trang {meta.pageNumber}
      </div>

      {isVisible ? (
        <canvas ref={canvasRef} className="block w-full h-auto mx-auto" />
      ) : (
        <div
          className="w-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs font-medium"
          style={{ height: `${displayHeight}px` }}
        >
          Trang {meta.pageNumber}
        </div>
      )}
    </div>
  );
};
