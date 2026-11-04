import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

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

  // Responsive Container Width Tracking (Fit-to-Width Adaptation)
  const [containerWidth, setContainerWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? window.innerWidth : 800;
    }
    return 800;
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w && w > 0) {
        setContainerWidth(Math.floor(w));
      }
    });

    ro.observe(el);
    window.addEventListener('resize', updateWidth);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Pinch-to-zoom touch gesture state (50% to 150%)
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(zoom);

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

        // Thử tải qua URL chính, nếu gặp lỗi mạng/CORS/404 tự động fallback sang URL Supabase trực tiếp
        let res: Response;
        try {
          res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (fetchErr) {
          const directSupabaseUrl = url.includes('workers.dev')
            ? url.replace(/https:\/\/[a-z0-9-]+\.workers\.dev\/([^/?#]+)/i, 'https://lnqckqgotffitlinxgfr.supabase.co/storage/v1/object/public/exam-pdfs/exams/$1')
            : null;
          if (directSupabaseUrl && directSupabaseUrl !== url) {
            console.warn('Không tải được qua CDN, tự động chuyển sang tải trực tiếp từ Supabase Storage:', fetchErr);
            res = await fetch(directSupabaseUrl);
            if (!res.ok) throw new Error(`Không tải được tệp PDF (HTTP ${res.status})`);
          } else {
            throw fetchErr;
          }
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

  // Handle pinch-to-zoom for touch devices: bounded within 50% - 150% (0.5 - 1.5)
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
      const targetZoom = Math.min(1.5, Math.max(0.5, parseFloat((touchStartZoomRef.current * ratio).toFixed(2))));
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

  // Padding dynamically matches device screen width
  const padding = containerWidth < 640 ? 12 : 24;
  const availableWidth = Math.max(260, containerWidth - padding);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`flex-1 overflow-y-auto overflow-x-auto bg-[#525659] p-2 sm:p-4 select-none touch-pan-x touch-pan-y ${className}`}
    >
      {/* 
        QUAN TRỌNG: KHÔNG DÙNG items-center TRÊN CONTAINER CUỘN NGOÀI CÙNG!
        Dùng 'min-w-full w-max flex flex-col items-center mx-auto' để:
        - Khi trang nhỏ hơn màn hình: Được canh giữa trang trọng.
        - Khi trang phóng to > 100%: Lề trái bám sát x=0, học sinh cuộn ngang từ mép trái mượt mà,
          triệt tiêu 100% lỗi âm toạ độ cuộn làm cụt mất chữ "TRƯỜNG THCS-THPT..." ở lề trái!
      */}
      <div className="min-w-full w-max flex flex-col items-center space-y-4 pb-12 mx-auto">
        {pages.map((p) => {
          // Tính toán Fit-to-Width cơ sở theo tỉ lệ màn hình
          const isMobile = containerWidth < 768;
          const baseFitScale = isMobile
            ? availableWidth / p.width
            : Math.min(availableWidth / p.width, 1.35);

          const effectiveScale = baseFitScale * zoom;
          const displayWidth = Math.round(p.width * effectiveScale);
          const displayHeight = Math.round(p.height * effectiveScale);

          return (
            <PdfPageCanvas
              key={p.pageNumber}
              doc={pdfDocRef.current}
              meta={p}
              effectiveScale={effectiveScale}
              displayWidth={displayWidth}
              displayHeight={displayHeight}
              onVisible={() => onPageVisible?.(p.pageNumber)}
            />
          );
        })}
      </div>
    </div>
  );
};

interface PdfPageCanvasProps {
  doc: any;
  meta: PageMeta;
  effectiveScale: number;
  displayWidth: number;
  displayHeight: number;
  onVisible?: () => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = ({
  doc,
  meta,
  effectiveScale,
  displayWidth,
  displayHeight,
  onVisible,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [rendered, setRendered] = useState<boolean>(false);

  // Virtualization: IntersectionObserver to render only visible pages (+300px threshold)
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

  // Render canvas when page becomes visible or scale changes
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
        const scaledViewport = page.getViewport({ scale: effectiveScale * dpr });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (isCancelled) return;
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
  }, [isVisible, doc, meta.pageNumber, effectiveScale, displayWidth, displayHeight]);

  return (
    <div
      ref={containerRef}
      className="relative bg-white rounded-lg shadow-md transition-shadow overflow-hidden flex items-center justify-center mx-auto"
      style={{
        width: `${displayWidth}px`,
        minHeight: `${displayHeight}px`,
      }}
    >
      {/* Page number badge */}
      <div className="absolute top-2 left-2 z-10 bg-slate-900/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full pointer-events-none">
        Trang {meta.pageNumber}
      </div>

      {isVisible ? (
        <canvas
          ref={canvasRef}
          className="block mx-auto"
          style={{ width: `${displayWidth}px`, height: `${displayHeight}px` }}
        />
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
