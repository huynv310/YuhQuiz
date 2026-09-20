import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

const BLUE = '#2563EB';
const GREEN = '#1DB954';
const INK = '#0F172A';

// Mũ cử nhân dựng từ hình khối cơ bản
function GradCap() {
  return (
    <group rotation={[0.25, 0, 0]}>
      <mesh position={[0, 0.55, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[3.1, 0.14, 3.1]} />
        <meshStandardMaterial color={INK} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.95, 1.1, 0.95, 48]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.63, 0]}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial color={GREEN} />
      </mesh>
      {/* dây tua */}
      <mesh position={[1.15, 0.05, 1.15]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 8]} />
        <meshStandardMaterial color={GREEN} />
      </mesh>
      <mesh position={[1.15, -0.7, 1.15]}>
        <coneGeometry args={[0.13, 0.35, 16]} />
        <meshStandardMaterial color={GREEN} />
      </mesh>
      <mesh position={[0.6, 0.6, 0.6]} rotation={[Math.PI / 2, 0, -Math.PI / 4]}>
        <cylinderGeometry args={[0.025, 0.025, 1.7, 8]} />
        <meshStandardMaterial color={GREEN} />
      </mesh>
    </group>
  );
}

// Tờ đề thi với phiếu trả lời
function Sheet({ picks }: { picks: number[] }) {
  return (
    <group>
      <RoundedBox args={[1.7, 2.3, 0.07]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </RoundedBox>
      <mesh position={[-0.3, 0.85, 0.05]}>
        <boxGeometry args={[0.8, 0.09, 0.02]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      {picks.map((pick, row) => (
        <group key={row} position={[0, 0.4 - row * 0.42, 0.05]}>
          {[0, 1, 2, 3].map((c) => (
            <mesh key={c} position={[-0.5 + c * 0.33, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.02, 20]} />
              <meshStandardMaterial color={c === pick ? GREEN : '#CBD5E1'} />
            </mesh>
          ))}
        </group>
      ))}
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
          <torusGeometry args={[radius, 0.012, 8, 128]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
        <mesh position={[radius, 0, 0]}>
          <sphereGeometry args={[0.13, 20, 20]} />
          <meshStandardMaterial color={color} />
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
    ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, state.pointer.x * 0.5, k);
    ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, -state.pointer.y * 0.25, k);
  });
  return <group ref={ref}>{children}</group>;
}

export default function LandingScene() {
  return (
    <Canvas camera={{ position: [0, 0, 11.5], fov: 40 }} dpr={[1, 1.6]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={1.5} />
      <directionalLight position={[6, 8, 5]} intensity={1.6} />
      <directionalLight position={[-6, -4, -3]} intensity={0.6} color="#60a5fa" />
      <Rig>
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.8}>
          <GradCap />
        </Float>
        <Float speed={1.1} rotationIntensity={0.4} floatIntensity={1.1}>
          <group position={[-2.6, -1.6, 0.6]} rotation={[0.1, 0.4, -0.12]}><Sheet picks={[0, 2, 1]} /></group>
        </Float>
        <Float speed={1.7} rotationIntensity={0.4} floatIntensity={1.2}>
          <group position={[2.8, 1.7, -0.4]} rotation={[-0.1, -0.5, 0.15]} scale={0.85}><Sheet picks={[3, 1, 0]} /></group>
        </Float>
        <Orbit radius={2.9} tilt={1.15} speed={0.35} color={BLUE} />
        <Orbit radius={3.6} tilt={-0.8} speed={-0.25} color={GREEN} />
      </Rig>
      <Sparkles count={50} scale={[10, 7, 4]} size={2} speed={0.25} color="#3b82f6" opacity={0.5} />
    </Canvas>
  );
}
