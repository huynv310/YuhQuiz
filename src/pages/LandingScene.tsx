import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text3D, Center, MeshDistortMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

// ─── 3D HỆ SINH THÁI KHẢO THÍ (TINH TẾ & SẠCH SẼ) ───
function FloatingGeometry() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });
  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
      <mesh ref={meshRef} position={[6, 1, -6]} scale={2.5}>
        <icosahedronGeometry args={[1, 1]} />
        <meshPhysicalMaterial color="#2563EB" wireframe opacity={0.1} transparent />
      </mesh>
      <mesh position={[-7, -2, -8]} scale={2}>
        <torusKnotGeometry args={[1, 0.2, 128, 32]} />
        <MeshDistortMaterial color="#EA580C" speed={2} distort={0.2} opacity={0.15} transparent />
      </mesh>
    </Float>
  );
}

function FlyingGrades() {
  return (
    <>
      <Float speed={1} rotationIntensity={0.5} floatIntensity={1.2}>
        <Center position={[-5, 4, -4]}>
          <Text3D font="/helvetiker_regular.typeface.json" size={1.2} height={0.1} bevelEnabled bevelThickness={0.01} bevelSize={0.01}>
            A+
            <meshStandardMaterial color="#16A34A" />
          </Text3D>
        </Center>
      </Float>
      <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
        <Center position={[5, -3, -3]}>
          <Text3D font="/helvetiker_regular.typeface.json" size={0.8} height={0.1}>
            10.0
            <meshStandardMaterial color="#EA580C" />
          </Text3D>
        </Center>
      </Float>
    </>
  );
}

export default function LandingScene() {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 42 }} dpr={[1, 1.5]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[10, 10, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-8, -6, -4]} intensity={0.5} color="#3b82f6" />
      <FloatingGeometry />
      <FlyingGrades />
      <Sparkles count={60} scale={14} size={1} speed={0.2} color="#3b82f6" opacity={0.3} />
    </Canvas>
  );
}
