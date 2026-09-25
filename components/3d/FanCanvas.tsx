"use client";

import React, { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float } from "@react-three/drei";
import * as THREE from "three";

interface FanSceneProps {
  isOn: boolean;
  speed?: number; // 1 to 5
}

function FanModel({ isOn, speed = 3 }: FanSceneProps) {
  const rotorRef = useRef<THREE.Group>(null);
  const currentSpeed = useRef(0);

  useFrame((_, delta) => {
    if (rotorRef.current) {
      const targetSpeed = isOn ? speed * 6 : 0;
      currentSpeed.current = THREE.MathUtils.lerp(
        currentSpeed.current,
        targetSpeed,
        delta * 2.5
      );
      rotorRef.current.rotation.y += currentSpeed.current * delta;
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      {/* Downrod */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.8, 16]} />
        <meshStandardMaterial color="#1E2026" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Main Motor Housing */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.38, 0.42, 0.26, 32]} />
        <meshStandardMaterial color="#3a3c44" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Glowing Neon LED Ring */}
      <mesh position={[0, 0.27, 0]}>
        <torusGeometry args={[0.39, 0.02, 16, 32]} />
        <meshStandardMaterial
          color={isOn ? "#E8F047" : "#55585f"}
          emissive={isOn ? "#C7D22A" : "#000000"}
          emissiveIntensity={isOn ? 2.0 : 0}
        />
      </mesh>

      {/* Rotating 3-Blade Aerodynamic Rotor */}
      <group ref={rotorRef} position={[0, 0.38, 0]}>
        {/* Blade 1 */}
        <mesh position={[0.65, 0, 0]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.92, 0.02, 0.18]} />
          <meshStandardMaterial color="#555862" roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Blade 2 */}
        <mesh position={[-0.325, 0, 0.563]} rotation={[0, (Math.PI * 2) / 3, 0.12]}>
          <boxGeometry args={[0.92, 0.02, 0.18]} />
          <meshStandardMaterial color="#555862" roughness={0.35} metalness={0.6} />
        </mesh>

        {/* Blade 3 */}
        <mesh position={[-0.325, 0, -0.563]} rotation={[0, -(Math.PI * 2) / 3, -0.12]}>
          <boxGeometry args={[0.92, 0.02, 0.18]} />
          <meshStandardMaterial color="#555862" roughness={0.35} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

export const FanCanvas: React.FC<FanSceneProps> = ({ isOn, speed = 3 }) => {
  return (
    <div className="w-full h-64 sm:h-72 relative">
      <Canvas
        camera={{ position: [0, 1.8, 2.8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 2]} intensity={1.5} />
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.15}>
          <FanModel isOn={isOn} speed={speed} />
        </Float>
        <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2.2} minPolarAngle={Math.PI / 6} />
      </Canvas>
    </div>
  );
};
