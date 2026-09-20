import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, RoundedBox, Environment, Lightformer, ContactShadows, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

const BLUE = '#2563EB';
const NAVY = '#1E3A8A';
const INK = '#0B1226';
const GOLD = '#F5B301';
const PAPER = '#FFF7E6';

// ── Mũ cử nhân: vành mũ, thân mũ (lathe), núm vàng, dây tua kim loại ──
function GradCap() {
  const bodyGeo = useMemo(() => {
    const pts = [[0.02, -0.62], [0.9, -0.62], [1.02, -0.5], [1.04, -0.05], [0.98, 0.3], [0.86, 0.5], [0.02, 0.5]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 64);
  }, []);
  const cordGeo = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.78, 0),
      new THREE.Vector3(0.7, 0.86, 0.5),
      new THREE.Vector3(1.55, 0.78, 1.05),
      new THREE.Vector3(1.7, 0.3, 1.2),
      new THREE.Vector3(1.72, -0.45, 1.22),
    ]);
    return new THREE.TubeGeometry(c, 48, 0.028, 10, false);
  }, []);
  const strands = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [Math.cos(a) * 0.075, Math.sin(a) * 0.075] as const;
  }), []);

  return (
    <group rotation={[0.28, 0, 0]}>
      <mesh geometry={bodyGeo}>
        <meshPhysicalMaterial color={NAVY} roughness={0.42} clearcoat={0.6} clearcoatRoughness={0.35} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <RoundedBox args={[3.4, 0.16, 3.4]} radius={0.05} smoothness={4}>
          <meshPhysicalMaterial color={INK} roughness={0.32} metalness={0.15} clearcoat={0.8} clearcoatRoughness={0.25} />
        </RoundedBox>
      </mesh>
      {/* viền xanh dưới vành mũ */}
      <mesh position={[0, 0.41, 0]} rotation={[0, Math.PI / 4, 0]}>
        <RoundedBox args={[3.44, 0.04, 3.44]} radius={0.015} smoothness={2}>
          <meshStandardMaterial color={BLUE} roughness={0.4} />
        </RoundedBox>
      </mesh>
      {/* núm vàng */}
      <mesh position={[0, 0.8, 0]} scale={[1, 0.6, 1]}>
        <sphereGeometry args={[0.14, 32, 32]} />
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.22} />
      </mesh>
      {/* dây tua */}
      <mesh geometry={cordGeo}>
        <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} />
      </mesh>
      <group position={[1.72, -0.5, 1.22]}>
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.07, 0.06, 0.16, 20]} />
          <meshStandardMaterial color={GOLD} metalness={1} roughness={0.25} />
        </mesh>
        {strands.map(([x, z], i) => (
          <mesh key={i} position={[x, -0.22, z]} rotation={[z * 1.6, 0, -x * 1.6]}>
            <cylinderGeometry args={[0.012, 0.008, 0.55, 6]} />
            <meshStandardMaterial color={GOLD} metalness={1} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ── Chồng sách ──
function Books() {
  const rows = [
    { y: 0, w: 2.2, c: BLUE, r: 0.05 },
    { y: 0.3, w: 1.95, c: '#10B981', r: -0.09 },
    { y: 0.6, w: 1.7, c: '#F59E0B', r: 0.12 },
  ];
  return (
    <group>
      {rows.map((b, i) => (
        <group key={i} position={[0, b.y, 0]} rotation={[0, b.r, 0]}>
          <RoundedBox args={[b.w, 0.26, 1.5]} radius={0.03} smoothness={3}>
            <meshPhysicalMaterial color={b.c} roughness={0.45} clearcoat={0.4} />
          </RoundedBox>
          {/* mép giấy */}
          <mesh position={[0.02, 0, 0.05]}>
            <boxGeometry args={[b.w - 0.1, 0.19, 1.5]} />
            <meshStandardMaterial color={PAPER} roughness={0.9} />
          </mesh>
          <RoundedBox args={[b.w, 0.26, 0.09]} radius={0.02} smoothness={2} position={[0, 0, -0.71]}>
            <meshPhysicalMaterial color={b.c} roughness={0.45} clearcoat={0.4} />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

// ── Bằng khen cuộn tròn có ruy băng ──
function Diploma() {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 1.7, 32]} />
        <meshStandardMaterial color={PAPER} roughness={0.8} />
      </mesh>
      {[0.85, -0.85].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <torusGeometry args={[0.12, 0.05, 12, 32]} />
          <meshStandardMaterial color="#FDE7B0" roughness={0.9} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.235, 0.235, 0.16, 32]} />
        <meshPhysicalMaterial color="#EF4444" roughness={0.35} clearcoat={0.7} />
      </mesh>
    </group>
  );
}

// ── Bút chì ──
function Pencil() {
  return (
    <group>
      <mesh>
        <cylinderGeometry args={[0.13, 0.13, 1.5, 6]} />
        <meshPhysicalMaterial color="#FBBF24" roughness={0.4} clearcoat={0.5} />
      </mesh>
      <mesh position={[0, -0.95, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.13, 0.4, 6]} />
        <meshStandardMaterial color="#F4D9B0" roughness={0.8} />
      </mesh>
      <mesh position={[0, -1.12, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.04, 0.12, 12]} />
        <meshStandardMaterial color="#1F2937" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.135, 0.135, 0.16, 20]} />
        <meshStandardMaterial color="#CBD5E1" metalness={1} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.98, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.18, 20]} />
        <meshStandardMaterial color="#FB7185" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ── Huy hiệu dấu tick ──
function CheckBadge() {
  const tick = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-0.42, -0.02); s.lineTo(-0.31, 0.09); s.lineTo(-0.14, -0.08);
    s.lineTo(0.3, 0.36); s.lineTo(0.41, 0.25); s.lineTo(-0.14, -0.3); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  }, []);
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.78, 0.78, 0.2, 48]} />
        <meshPhysicalMaterial color="#16A34A" roughness={0.3} clearcoat={0.8} />
      </mesh>
      <mesh geometry={tick} position={[0, 0.02, 0.1]}>
        <meshStandardMaterial color="#ffffff" roughness={0.3} />
      </mesh>
    </group>
  );
}

function Orbit({ radius, tilt, speed, color }: { radius: number; tilt: number; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * speed; });
  return (
    <group rotation={[tilt, 0, 0]}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[radius, 0.012, 8, 160]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
        <mesh position={[radius, 0, 0]}>
          <sphereGeometry args={[0.13, 24, 24]} />
          <meshPhysicalMaterial color={color} roughness={0.25} clearcoat={1} />
        </mesh>
      </group>
    </group>
  );
}

// Nhóm cảnh nghiêng nhẹ theo con trỏ chuột
function Rig({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const k = 1 - Math.pow(0.001, dt);
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.45, k);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.2, k);
  });
  return <group ref={ref}>{children}</group>;
}

export default function LandingScene({ onSlow }: { onSlow?: () => void }) {
  return (
    <Canvas camera={{ position: [0, 0.4, 12], fov: 40 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>
      {/* Máy yếu (khung hình thấp kéo dài): báo để trang tắt cảnh 3D, giữ trang mượt */}
      <PerformanceMonitor ms={250} iterations={6} flipflops={1} onFallback={() => onSlow?.()} />
      {/* Ánh sáng môi trường dựng tại chỗ (không tải HDR từ mạng) để kim loại và lớp bóng có phản chiếu */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 6, 5]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#93c5fd" position={[-7, 2, 3]} scale={[4, 7, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#a7f3d0" position={[7, -1, 2]} scale={[4, 6, 1]} />
        <Lightformer form="ring" intensity={2} position={[0, 0, -6]} scale={8} />
      </Environment>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 6]} intensity={1.4} />

      <Rig>
        <Float speed={1.3} rotationIntensity={0.18} floatIntensity={0.7}>
          <group position={[0, 0.7, 0]} scale={0.95}><GradCap /></group>
        </Float>
        <Float speed={1.1} rotationIntensity={0.15} floatIntensity={0.5}>
          <group position={[-2.6, -2.5, 0.8]} rotation={[0.12, 0.5, 0]} scale={0.78}><Books /></group>
        </Float>
        <Float speed={1.6} rotationIntensity={0.5} floatIntensity={0.9}>
          <group position={[2.7, -2.1, 0.9]} rotation={[0.3, 0.5, 0.45]} scale={1.05}><Diploma /></group>
        </Float>
        <Float speed={1.5} rotationIntensity={0.4} floatIntensity={1}>
          <group position={[-3.2, 2.6, 0]} rotation={[0, 0, 0.95]} scale={0.95}><Pencil /></group>
        </Float>
        <Float speed={1.8} rotationIntensity={0.3} floatIntensity={1}>
          <group position={[3.1, 2.5, -0.4]} rotation={[0.2, -0.35, 0]} scale={0.8}><CheckBadge /></group>
        </Float>
        <Orbit radius={3.4} tilt={1.15} speed={0.3} color={BLUE} />
        <Orbit radius={4.1} tilt={-0.8} speed={-0.22} color="#10B981" />
      </Rig>
      <ContactShadows frames={1} resolution={256} position={[0, -3.6, 0]} opacity={0.25} scale={12} blur={2.8} far={4} />
      <Sparkles count={45} scale={[10, 8, 4]} size={2.2} speed={0.25} color="#3b82f6" opacity={0.5} />
    </Canvas>
  );
}
