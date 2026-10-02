import { useState, useEffect, useRef } from 'react';

export function useExamTimer(
  durationMinutes: number,
  sessionKey: string,
  onTimeOut: () => void,
  isSubmitted: boolean = false,
  serverTimeOffsetMs: number = 0,
  /** false cho tới khi đã thử lấy giờ server xong — tránh chốt hạn nộp theo offset 0 rồi bị lệch. */
  clockReady: boolean = true,
  /** started_at (ms, giờ server) của phiên — nguồn chuẩn, khớp đúng hạn mà server dùng để chặn nộp muộn. */
  serverStartedAtMs: number | null = null
) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const onTimeOutRef = useRef(onTimeOut);
  onTimeOutRef.current = onTimeOut;
  const offsetRef = useRef(serverTimeOffsetMs);
  offsetRef.current = serverTimeOffsetMs;

  useEffect(() => {
    // Nếu đã nộp bài hoặc chưa tải xong thời gian làm bài (> 0 phút) thì không đếm
    if (isSubmitted || !durationMinutes || durationMinutes <= 0 || !clockReady) {
      return;
    }

    // now() dùng giờ server bù trừ, không tin tuyệt đối đồng hồ máy học sinh
    const now = () => Date.now() + offsetRef.current;

    // v2: bỏ các mốc cũ từng bị tính với offset 0 (máy chạy chậm giờ → bị tự nộp sớm)
    const expireKey = `exam_expire_v2_${sessionKey}_${durationMinutes}`;
    const stored = parseInt(localStorage.getItem(expireKey) || '', 10);
    const targetMs = serverStartedAtMs
      ? serverStartedAtMs + durationMinutes * 60 * 1000
      : Number.isFinite(stored) ? stored : now() + durationMinutes * 60 * 1000;
    if (targetMs !== stored) localStorage.setItem(expireKey, targetMs.toString());
    const initialDiff = Math.floor((targetMs - now()) / 1000);

    // Nếu thời gian đã hết từ trước
    if (initialDiff <= 0) {
      setSecondsRemaining(0);
      onTimeOutRef.current();
      return;
    }

    setSecondsRemaining(initialDiff);

    // Đếm ngược mỗi giây
    const interval = setInterval(() => {
      const diff = Math.floor((targetMs - now()) / 1000);
      if (diff <= 0) {
        setSecondsRemaining(0);
        clearInterval(interval);
        onTimeOutRef.current(); // Chỉ gọi khi thực sự đếm về 0
      } else {
        setSecondsRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMinutes, sessionKey, isSubmitted, clockReady, serverStartedAtMs]);

  // Trả về số giây còn lại, hoặc mặc định theo số phút của đề thi nếu chưa khởi tạo xong
  if (secondsRemaining !== null) {
    return secondsRemaining;
  }
  return durationMinutes > 0 ? durationMinutes * 60 : 0;
}
