import { useEffect, useRef, useState } from 'react';

export function useAntiCheat(
  enabled: boolean = true,
  onCheatingLogged?: (cheatCount: number, totalAwaySecs: number) => void,
  onEvent?: (reason: string, awaySecs: number) => void
) {
  const [cheatCount, setCheatCount] = useState<number>(0);
  const [totalAwaySecs, setTotalAwaySecs] = useState<number>(0);
  const [lastWarningReason, setLastWarningReason] = useState<string | null>(null);

  const awayStartTime = useRef<number | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWidth = useRef<number>(window.innerWidth);
  const lastHeight = useRef<number>(window.innerHeight);
  const lastOuterWidth = useRef<number>(window.outerWidth);
  const isRotating = useRef<boolean>(false);
  const rotationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recordViolation = (reason: string, awaySecs: number = 0) => {
    // NẾU TẮT HOẶC ĐÃ NỘP BÀI THÌ TUYỆT ĐỐI KHÔNG GHI NHẬN VI PHẠM
    if (!enabled) return;

    onEvent?.(reason, awaySecs);
    setCheatCount(prev => {
      const next = prev + 1;
      setTotalAwaySecs(currAway => {
        const total = currAway + awaySecs;
        if (onCheatingLogged) onCheatingLogged(next, total);
        return total;
      });
      return next;
    });
    setLastWarningReason(reason);
  };

  useEffect(() => {
    // KHI ĐÃ NỘP BÀI (!enabled) -> HOÀN TOÀN TẮT BỎ CÁC BỘ CẢM BIẾN THEO DÕI
    if (!enabled) {
      return;
    }

    // 1. Phát hiện chuyển Tab & Ẩn trang (Page Visibility)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        awayStartTime.current = Date.now();
      } else {
        if (awayStartTime.current) {
          const awaySecs = Math.max(1, Math.floor((Date.now() - awayStartTime.current) / 1000));
          recordViolation('Chuyển sang tab hoặc ứng dụng khác', awaySecs);
          awayStartTime.current = null;
        }
      }
    };

    // 2. Phát hiện Mất tiêu điểm cửa sổ (Window Blur) với debounce 1.5s
    const handleBlur = () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      blurTimer.current = setTimeout(() => {
        if (!awayStartTime.current) {
          awayStartTime.current = Date.now();
        }
      }, 1500);
    };

    const handleFocus = () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      if (awayStartTime.current) {
        const awaySecs = Math.max(1, Math.floor((Date.now() - awayStartTime.current) / 1000));
        recordViolation('Mất tiêu điểm cửa sổ làm bài', awaySecs);
        awayStartTime.current = null;
      }
    };

    // 3. XỬ LÝ XOAY MÀN HÌNH DI ĐỘNG (NGĂN CHẶN BỊ BÁO CHEAT KHI XOAY NGANG / DỌC)
    const handleOrientationChange = () => {
      isRotating.current = true;
      if (rotationTimer.current) clearTimeout(rotationTimer.current);
      rotationTimer.current = setTimeout(() => {
        isRotating.current = false;
        lastWidth.current = window.innerWidth;
        lastHeight.current = window.innerHeight;
      }, 1500);
    };

    // 4. PHÁT HIỆN MỞ THANH BÊN AI (CHỈ ÁP DỤNG TRÊN MÁY TÍNH DESKTOP)
    const handleResize = () => {
      const currentW = window.innerWidth;
      const currentH = window.innerHeight;

      // Kịch bản A: Thiết bị đang trong quá trình xoay màn hình (Orientation Change) -> Bỏ qua
      if (isRotating.current) {
        lastWidth.current = currentW;
        lastHeight.current = currentH;
        return;
      }

      // Kịch bản B: Hoán đổi tỷ lệ Dọc <-> Ngang (Width/Height swap trên điện thoại/máy tính bảng) -> Bỏ qua
      const isAspectSwap = 
        Math.abs(currentW - lastHeight.current) <= 80 && 
        Math.abs(currentH - lastWidth.current) <= 80;
      if (isAspectSwap) {
        lastWidth.current = currentW;
        lastHeight.current = currentH;
        return;
      }

      // Kịch bản C: Thiết bị cảm ứng di động (Mobile / Tablet) -> Bỏ qua thay đổi kích thước do bàn phím ảo hoặc xoay
      const isMobileDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isMobileDevice) {
        lastWidth.current = currentW;
        lastHeight.current = currentH;
        return;
      }

      // Kịch bản D (Desktop): Phát hiện co rút màn hình đột ngột khi mở thanh bên AI (Edge Copilot / Chrome Side Panel)
      // Phân biệt với người dùng tự kéo giãn/thu nhỏ cửa sổ trình duyệt: khi đó outerWidth (kích thước
      // cửa sổ thật) cũng thay đổi tương ứng; sidebar/AI panel chỉ ăn vào viewport (innerWidth), outerWidth
      // gần như không đổi.
      const currentOuterW = window.outerWidth;
      const delta = lastWidth.current - currentW;
      const outerDelta = Math.abs(lastOuterWidth.current - currentOuterW);
      if (delta >= 180 && currentW < 1100 && outerDelta < 80) {
        recordViolation('Phát hiện mở thanh bên AI / chia đôi màn hình', 2);
      }
      lastWidth.current = currentW;
      lastHeight.current = currentH;
      lastOuterWidth.current = currentOuterW;
    };

    // 5. PHÁT HIỆN THOÁT TOÀN MÀN HÌNH
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        recordViolation('Thoát chế độ toàn màn hình', 1);
      }
    };

    // 6. CHẶN PHÍM TẮT TRA CỨU & COPY/PASTE TRÊN MÁY TÍNH
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cho phép dán/sao chép trong ô nhập đáp án (tránh phạt oan khi gõ đáp án ngắn)
      const t = e.target as HTMLElement | null;
      const inEditable = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (inEditable && e.ctrlKey && !e.shiftKey && (e.key === 'c' || e.key === 'v')) return;
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'C' || e.key === 'c')) ||
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 's'))
      ) {
        e.preventDefault();
        recordViolation(`Sử dụng phím tắt bị cấm (${e.key})`, 0);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', handleOrientationChange);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (window.screen?.orientation) {
        window.screen.orientation.removeEventListener('change', handleOrientationChange);
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      if (blurTimer.current) clearTimeout(blurTimer.current);
      if (rotationTimer.current) clearTimeout(rotationTimer.current);
    };
  }, [enabled]);

  return { cheatCount, totalAwaySecs, lastWarningReason };
}
