import { useLayoutEffect, RefObject } from 'react';
import gsap from 'gsap';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Hiện dần các phần tử con có [data-reveal] trong container (bỏ qua nếu người dùng tắt hiệu ứng). */
export function useReveal(ref: RefObject<HTMLElement>, deps: unknown[] = []) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        opacity: 0, y: 14, duration: 0.45, ease: 'power2.out', stagger: 0.07, clearProps: 'all',
      });
    }, root);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Ánh sáng theo con trỏ trên các bề mặt kính (bỏ qua khi giảm chuyển động). */
export function initGlassPointer() {
  if (prefersReducedMotion()) return;
  let raf = 0;
  window.addEventListener('pointermove', (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = (e.target as Element | null)?.closest?.('.glass-panel, .glass-bar') as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }, { passive: true });
}

/** Popup: khóa cuộn nền, Esc để đóng (kích hoạt nút X có sẵn trong popup), tự focus vào popup. */
export function initModalBehavior() {
  if (typeof document === 'undefined') return;
  const overlays = () => Array.from(document.querySelectorAll<HTMLElement>('.yq-overlay'));
  const top = () => overlays().pop();
  const closeBtn = (o: HTMLElement) =>
    o.querySelector<HTMLButtonElement>('button[aria-label="Đóng"], button:has(> svg.lucide-x)');

  const sync = () => {
    const open = overlays().length > 0;
    document.body.style.overflow = open ? 'hidden' : '';
    const o = top();
    if (o && !o.contains(document.activeElement)) {
      const panel = o.firstElementChild as HTMLElement | null;
      panel?.setAttribute('tabindex', '-1');
      panel?.focus({ preventScroll: true });
    }
  };
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const o = top(); if (!o) return;
    const b = closeBtn(o); if (b) { e.preventDefault(); b.click(); }
  });
}
