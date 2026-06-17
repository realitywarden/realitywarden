import type { DeviceGeometry } from '@/types/deviceMeta';

export function targetPosition(target: string | undefined, geometry: DeviceGeometry): [number, number, number] {
  if (!target) return [0, 0, 0];
  if (geometry.zones[target]) return geometry.zones[target].position;
  const object = geometry.objects[target as keyof typeof geometry.objects];
  if (object && 'position' in object) return object.position;
  if (target === 'aisle_a') return [0.95, 0, 0.35];
  if (target === 'charging_dock') return [-1.35, 0, -0.75];
  if (target === 'bin_a') return [1.15, 0.45, -0.55];
  if (target === 'restricted_zone') return [1.25, 0, 1.05];
  return [0, 0, 0];
}
