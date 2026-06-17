'use client';

function resolveLightColor(value: unknown) {
  if (value === 'warm_white') return '#FFD58A';
  if (value === 'red') return '#E11D48';
  if (value === 'green') return '#059669';
  return '#F3F4F6';
}

export function SemanticSmartLight({ state }: { state: Record<string, unknown> }) {
  const visual = state.visual_state as Record<string, unknown> | undefined;
  const brightness = Number(visual?.brightness ?? state.brightness ?? 0);
  const on = state.status === 'on' || brightness > 0;
  const color = resolveLightColor(visual?.color ?? state.color);

  return (
    <group>
      <mesh position={[0, 0.035, 0]}>
        <cylinderGeometry args={[0.34, 0.38, 0.07, 40]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.76} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 1.25, 24]} />
        <meshStandardMaterial color="#4B5563" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.24, 0]}>
        <cylinderGeometry args={[0.26, 0.2, 0.16, 36]} />
        <meshStandardMaterial color="#4B5563" roughness={0.86} metalness={0.12} />
      </mesh>
      <mesh position={[0, 1.36, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.28, 0.18, 40]} />
        <meshStandardMaterial color="#4B5563" emissive={on ? color : '#000000'} emissiveIntensity={on ? Math.max(0.2, brightness / 55) : 0} roughness={0.9} metalness={0.1} />
      </mesh>
      {on && (
        <mesh position={[0, 1.36, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.58, 0.85, 40, 1, true]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} transparent opacity={0.16} roughness={0.92} metalness={0.02} />
        </mesh>
      )}
    </group>
  );
}
