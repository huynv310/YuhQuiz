import React from 'react';

// Biểu tượng edtech (mũ cử nhân), cùng hình với public/icon.svg
export function LogoMark({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="YuhQuiz">
      <defs><linearGradient id="yqg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="url(#yqg)" />
      <path d="M50 24 L88 43 L50 62 L12 43 Z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" />
      <path d="M28 51 V68 C28 78 72 78 72 68 V51" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <path d="M88 43 V68" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
