import { useEffect, useState } from 'react';

/** Mốc reset mùa xếp hạng hàng năm — phải khớp academic_year_start() trong migration DB. */
const RESET_MONTH = 8; // Tháng 9 (0-indexed)
const RESET_DAY = 5;

function nextResetDate(from: Date): Date {
  const y = from.getFullYear();
  const thisYear = new Date(y, RESET_MONTH, RESET_DAY, 0, 0, 0, 0);
  return from < thisYear ? thisYear : new Date(y + 1, RESET_MONTH, RESET_DAY, 0, 0, 0, 0);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Định dạng theo "cảm nhận thời gian": còn xa → tháng+ngày, còn vài ngày → ngày+giờ, còn ít → giờ:phút:giây. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Đang chuyển mùa mới...';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days >= 45) {
    const months = Math.floor(days / 30);
    const restDays = days % 30;
    return `${months} tháng ${restDays} ngày`;
  }
  if (days >= 1) {
    return `${days} ngày ${hours} giờ`;
  }
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/** Tần suất cập nhật càng thưa khi còn xa mốc reset — tránh render lãng phí khi countdown còn hàng tháng. */
function nextTickDelay(ms: number): number {
  const days = ms / 86400000;
  if (days >= 45) return 60 * 60 * 1000; // còn hàng tháng: 1 giờ/lần là đủ
  if (days >= 1) return 60 * 1000; // còn vài ngày: 1 phút/lần
  return 1000; // còn dưới 1 ngày: đếm theo giây
}

export interface SeasonCountdown {
  label: string;
  resetDate: Date;
}

/** Đếm ngược đến lần reset bảng xếp hạng tiếp theo (mặc định 5/9 hàng năm), tự giãn nhịp cập nhật. */
export function useSeasonCountdown(): SeasonCountdown {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      const remaining = nextResetDate(new Date(t)).getTime() - t;
      timer = setTimeout(tick, nextTickDelay(remaining));
    };
    const initialRemaining = nextResetDate(new Date()).getTime() - Date.now();
    timer = setTimeout(tick, nextTickDelay(initialRemaining));
    return () => clearTimeout(timer);
  }, []);

  const resetDate = nextResetDate(new Date(now));
  const msRemaining = resetDate.getTime() - now;
  return { label: formatCountdown(msRemaining), resetDate };
}
