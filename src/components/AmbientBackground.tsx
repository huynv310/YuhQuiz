import React, { Suspense, lazy, useEffect, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

const Scene = lazy(() => import('./AmbientScene'));

/** Nền 3D nhẹ phía sau mọi màn hình (trừ phòng thi). Tự tắt khi giảm chuyển động / máy yếu / tiết kiệm dữ liệu. */
export const AmbientBackground: React.FC = () => {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState(document.documentElement.dataset.mode || '');
  useEffect(() => {
    const mo = new MutationObserver(() => setMode(document.documentElement.dataset.mode || ''));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => {
    const nav: any = navigator;
    const weak = (nav.hardwareConcurrency || 4) <= 2 || nav.connection?.saveData;
    if (prefersReducedMotion() || weak) return;
    const w = window as any;
    const start = () => setOn(true);
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 600);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, []);
  return (
    <div aria-hidden className="ambient-bg fixed inset-0 -z-0 pointer-events-none">
      {on && mode !== 'exam_room' && mode !== 'landing' && <Suspense fallback={null}><Scene /></Suspense>}
    </div>
  );
};
