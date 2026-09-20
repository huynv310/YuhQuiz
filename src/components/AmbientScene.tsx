import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const COLORS = ['#FF4D8D', '#22D3EE', '#8B5CF6', '#FB923C', '#34D399', '#3B82F6', '#FACC15', '#F472B6', '#06B6D4', '#A78BFA'];
const COUNT = 10;

/** Texture tròn mềm (gradient xuyên tâm) → bong bóng mờ nhẹ mà không cần post-processing. */
function makeSoftTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, color + 'CC');
  grad.addColorStop(0.45, color + '77');
  grad.addColorStop(0.8, color + '22');
  grad.addColorStop(1, color + '00');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Bubbles() {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const { viewport } = useThree();
  const items = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const size = 1.6 + Math.random() * 3.6;           // kích thước ngẫu nhiên
    const ang = Math.random() * Math.PI * 2;
    const speed = 0.25 + Math.random() * 0.45;         // đơn vị thế giới / giây
    return {
      tex: makeSoftTexture(COLORS[i % COLORS.length]),
      size,
      x: (Math.random() - 0.5) * 14, y: (Math.random() - 0.5) * 9,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      turn: 0.3 + Math.random() * 0.6,                 // tốc độ đổi hướng
      seed: Math.random() * 100,
      z: -Math.random() * 3,
      opacity: 0.55 + Math.random() * 0.3,
    };
  }), []);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const d = Math.min(dt, 0.05);
    items.forEach((it, i) => {
      const s = refs.current[i];
      if (!s) return;
      // lang thang: hướng quay ngẫu nhiên liên tục (nhiễu sin chồng nhau) → không bao giờ đứng yên
      const a = Math.sin(t * it.turn + it.seed) + Math.sin(t * it.turn * 0.37 + it.seed * 2.1);
      const c = Math.cos(a * d), sn = Math.sin(a * d);
      const vx = it.vx * c - it.vy * sn, vy = it.vx * sn + it.vy * c;
      it.vx = vx; it.vy = vy;
      it.x += vx * d; it.y += vy * d;
      // ra khỏi màn hình thì hiện lại ở phía đối diện
      const hw = viewport.width / 2 + it.size * 0.6, hh = viewport.height / 2 + it.size * 0.6;
      if (it.x > hw) it.x = -hw; else if (it.x < -hw) it.x = hw;
      if (it.y > hh) it.y = -hh; else if (it.y < -hh) it.y = hh;
      s.position.set(it.x, it.y, it.z);
      const k = 1 + Math.sin(t * 0.5 + it.seed) * 0.08;  // "thở" nhẹ
      s.scale.set(it.size * k, it.size * k, 1);
    });
  });

  return (
    <>
      {items.map((it, i) => (
        <sprite key={i} ref={el => (refs.current[i] = el)}>
          <spriteMaterial map={it.tex} transparent opacity={it.opacity} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
}

export default function AmbientScene() {
  return (
    <Canvas dpr={[1, 1.25]} camera={{ position: [0, 0, 8], fov: 50 }}
            gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }} style={{ background: 'transparent' }}>
      <Bubbles />
    </Canvas>
  );
}
