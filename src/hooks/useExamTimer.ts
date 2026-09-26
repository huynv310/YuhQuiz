import { useState, useEffect, useRef } from 'react';

export function useExamTimer(
  durationMinutes: number,
  sessionKey: string,
  onTimeOut: () => void,
  isSubmitted: boolean = false
) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const onTimeOutRef = useRef(onTimeOut);
  onTimeOutRef.current = onTimeOut;

  useEffect(() => {
    // Nếu đã nộp bài hoặc chưa tải xong thời gian làm bài (> 0 phút) thì không đếm
    if (isSubmitted || !durationMinutes || durationMinutes <= 0) {
      return;
    }

    const expireKey = `exam_expire_${sessionKey}_${durationMinutes}`;
    let expireTimestamp = localStorage.getItem(expireKey);

    if (!expireTimestamp) {
      // Lần đầu vào thi: Thiết lập mốc hết hạn theo ĐÚNG số phút của đề thi giáo viên giao
      const targetTime = Date.now() + durationMinutes * 60 * 1000;
      localStorage.setItem(expireKey, targetTime.toString());
      expireTimestamp = targetTime.toString();
    }

    const targetMs = parseInt(expireTimestamp, 10);
    const initialDiff = Math.floor((targetMs - Date.now()) / 1000);

    // Nếu thời gian đã hết từ trước
    if (initialDiff <= 0) {
      setSecondsRemaining(0);
      onTimeOutRef.current();
      return;
    }

    setSecondsRemaining(initialDiff);

    // Đếm ngược mỗi giây
    const interval = setInterval(() => {
      const diff = Math.floor((targetMs - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsRemaining(0);
        clearInterval(interval);
        onTimeOutRef.current(); // Chỉ gọi khi thực sự đếm về 0
      } else {
        setSecondsRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [durationMinutes, sessionKey, isSubmitted]);

  // Trả về số giây còn lại, hoặc mặc định theo số phút của đề thi nếu chưa khởi tạo xong
  if (secondsRemaining !== null) {
    return secondsRemaining;
  }
  return durationMinutes > 0 ? durationMinutes * 60 : 0;
}
