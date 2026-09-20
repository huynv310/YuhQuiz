import React, { useEffect, useState } from 'react';

/** Sinh mã QR ngay trên trình duyệt (không gửi link đề thi cho dịch vụ bên thứ ba). */
export const QrImage: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    import('qrcode')
      .then(m => m.toDataURL(text, { width: 320, margin: 1 }))
      .then(url => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [text]);
  return src ? <img src={src} alt="QR Code" className={className} /> : <div className={className} aria-busy="true" />;
};
