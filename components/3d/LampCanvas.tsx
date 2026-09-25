"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import * as THREE from "three";

interface LampSceneProps {
  isOn: boolean;
  brightness?: number; // 0 to 100
}

function LampModel({ isOn, brightness = 80 }: LampSceneProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const targetIntensity = isOn ? (brightness / 100) * 4 : 0;

  useFrame((_, delta) => {
    if (lightRef.current) {
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity,
        delta * 6
      );
    }
  });

  return (
    <group position={[0, 0.4, 0]}>
      {/* Hanging Cord */}
      <mesh position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.4, 16]} />
        <meshStandardMaterial color="#2B2D33" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Ceiling Canopy Cap */}
      <mesh position={[0, 1.78, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.08, 32]} />
        <meshStandardMaterial color="#1E2026" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Outer Modern Pendant Shade */}
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.9, 0.7, 32, 1, true]} />
        <meshStandardMaterial
          color={isOn ? "#E89B3E" : "#333742"}
          metalness={0.8}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Metallic Inner Reflector */}
      <mesh position={[0, 0.301, 0]}>
        <coneGeometry args={[0.88, 0.69, 32, 1, true]} />
        <meshStandardMaterial
          color={isOn ? "#FFC875" : "#4A4F5D"}
          metalness={0.95}
          roughness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glowing Warm Filament Bulb */}
      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <meshStandardMaterial
          color={isOn ? "#FFF0D4" : "#444855"}
          emissive={isOn ? "#FF9A26" : "#000000"}
          emissiveIntensity={isOn ? (brightness / 100) * 3.5 : 0}
          roughness={0.05}
        />
      </mesh>

      {/* Warm Point Light */}
      <pointLight
        ref={lightRef}
        position={[0, 0.1, 0]}
        color="#FFA834"
        distance={8}
        decay={2}
      />
    </group>
  );
}

export const LampCanvas: React.FC<LampSceneProps> = ({ isOn, brightness = 80 }) => {
  return (
    <div className="w-full h-48 sm:h-56 relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900/60 to-slate-900/90 border border-amber-500/20 shadow-inner">
      <Canvas
        camera={{ position: [0, 0.1, 3.2], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={isOn ? 0.9 : 0.3} />
        <directionalLight position={[3, 5, 2]} intensity={1.2} />
        <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.2}>
          <LampModel isOn={isOn} brightness={brightness} />
        </Float>
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 1.9} minPolarAngle={Math.PI / 4} />
      </Canvas>
    </div>
  );
};
