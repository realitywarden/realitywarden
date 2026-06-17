'use client';

import { useRef } from 'react';
import * as THREE from 'three';

export function SemanticCameraSensor({ state }: { state: Record<string, unknown> }) {
  const coneMaterial = useRef<THREE.MeshStandardMaterial | null>(null);
  const visual = state.visual_state as Record<string, unknown> | undefined;
  const captured = state.status === 'captured' || Number(visual?.capture_flash ?? 0) > 0;

  return (
    <group>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.9, 20]} />
        <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.56, 0.1, 0.44]} />
        <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.92, 0.08]}>
        <boxGeometry args={[0.42, 0.12, 0.12]} />
        <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <boxGeometry args={[0.9, 0.44, 0.42]} />
        <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 1.08, -0.32]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.12, 36]} />
        <meshStandardMaterial color="#18191B" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 1.08, -0.43]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.18, 32]} />
        <meshStandardMaterial color="#18191B" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.72, -1.28]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.95, 1.6, 4, 1, true]} />
        <meshStandardMaterial ref={coneMaterial} color={captured ? '#059669' : '#0066CC'} roughness={0.9} metalness={0.05} transparent opacity={captured ? 0.22 + Number(visual?.capture_flash ?? 0) * 0.18 : 0.12} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
