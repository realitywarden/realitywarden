'use client';

function resolveItemPosition(state: Record<string, unknown>): [number, number, number] {
  const visual = state.visual_state as Record<string, unknown> | undefined;
  if (Array.isArray(visual?.item_position)) return visual.item_position as [number, number, number];
  if (Array.isArray(state.item_position)) return state.item_position as [number, number, number];
  if (state.sorted_to === 'bin_a') return [1.15, 0.45, -0.55];
  if (state.status === 'running') return [0.35, 0.45, 0];
  return [-0.75, 0.45, 0];
}

export function SemanticConveyorBelt({ state }: { state: Record<string, unknown> }) {
  const itemPosition = resolveItemPosition(state);
  const visual = state.visual_state as Record<string, unknown> | undefined;
  const rollerRotation = Number(visual?.roller_rotation ?? 0);

  return (
    <group>
      <mesh position={[0, 0.13, 0]}>
        <boxGeometry args={[2.75, 0.12, 0.78]} />
        <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[2.42, 0.08, 0.58]} />
        <meshStandardMaterial color="#18191B" roughness={0.95} metalness={0} />
      </mesh>
      {[-0.42, 0.42].map((z) => (
        <mesh key={z} position={[0, 0.38, z]}>
          <boxGeometry args={[2.65, 0.12, 0.08]} />
          <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.6} />
        </mesh>
      ))}
      {[-1.25, 1.25].map((x) => (
        <mesh key={x} position={[x, 0.23, 0]} rotation={[Math.PI / 2, rollerRotation, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.72, 32]} />
          <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.6} />
        </mesh>
      ))}
      <mesh position={itemPosition}>
        <boxGeometry args={[0.28, 0.28, 0.28]} />
        <meshStandardMaterial color="#0066CC" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[1.35, 0.12, -0.72]}>
        <boxGeometry args={[0.72, 0.22, 0.44]} />
        <meshStandardMaterial color="#8A8D91" roughness={0.6} metalness={0.4} />
      </mesh>
      {[-1, 1].map((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * 1.12, -0.12, z * 0.28]}>
          <boxGeometry args={[0.08, 0.42, 0.08]} />
          <meshStandardMaterial color="#2B2D31" roughness={0.8} metalness={0.6} />
        </mesh>
      )))}
    </group>
  );
}
