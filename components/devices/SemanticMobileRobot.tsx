'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

function resolvePosition(state: Record<string, unknown>): [number, number, number] {
  const visual = state.visual_state as Record<string, unknown> | undefined;
  if (Array.isArray(visual?.position)) return visual.position as [number, number, number];
  if (Array.isArray(state.position)) return state.position as [number, number, number];
  if (state.location === 'aisle_a') return [0.95, 0, 0.35];
  if (state.location === 'restricted_zone') return [1.35, 0, 1.05];
  return [-1.35, 0, -0.75];
}

export function SemanticMobileRobot({ state }: { state: Record<string, unknown> }) {
  const position = useMemo(() => resolvePosition(state), [state]);
  const visual = state.visual_state as Record<string, unknown> | undefined;
  const path = Array.isArray(visual?.path) ? visual.path as [number, number, number][] : [];
  const pathLine = useMemo(() => {
    if (path.length < 2) return null;
    const geometry = new THREE.BufferGeometry().setFromPoints(path.map((point) => new THREE.Vector3(point[0], 0.035, point[2])));
    const material = new THREE.LineBasicMaterial({ color: '#0066CC', transparent: true, opacity: 0.82 });
    return new THREE.Line(geometry, material);
  }, [path]);

  return (
    <>
      {pathLine && <primitive object={pathLine} />}
      {path.map((point, index) => (
        <mesh key={`${point.join('-')}-${index}`} position={[point[0], 0.04, point[2]]}>
          <sphereGeometry args={[0.045, 16, 10]} />
          <meshStandardMaterial color="#0066CC" roughness={0.8} metalness={0.05} />
        </mesh>
      ))}
      <group position={position}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[1.32, 0.1, 0.9]} />
          <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <boxGeometry args={[1.15, 0.32, 0.72]} />
          <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.45} />
        </mesh>
        <mesh position={[0.18, 0.42, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.12, 36]} />
          <meshStandardMaterial color="#18191B" roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0.18, 0.51, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.06, 32]} />
          <meshStandardMaterial color="#0066CC" roughness={0.82} metalness={0.06} />
        </mesh>
        <mesh position={[0.6, 0.23, 0]}>
          <boxGeometry args={[0.06, 0.1, 0.42]} />
          <meshStandardMaterial color="#D1D5DB" roughness={0.5} metalness={0.1} />
        </mesh>
        {[-0.42, 0.42].map((x) =>
          [-0.42, 0.42].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 0.12, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.13, 0.13, 0.1, 24]} />
              <meshStandardMaterial color="#18191B" roughness={0.95} metalness={0} />
            </mesh>
          ))
        )}
        <mesh position={[1.55, 0.04, -0.35]}>
          <boxGeometry args={[0.8, 0.08, 0.5]} />
        <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.35} />
        </mesh>
      </group>
    </>
  );
}
