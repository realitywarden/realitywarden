import type { DeviceGeometry } from '@/types/deviceMeta';
import type { SimObject, Vec3, WorldState } from '@/types/simulation';

export function vec3(value: readonly number[]): Vec3 {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

export function distance(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function samplePath(from: Vec3, to: Vec3, samples = 12): Vec3[] {
  return Array.from({ length: samples + 1 }, (_, index) => lerp(from, to, index / samples));
}

export function targetToPosition(target: string | undefined, world: WorldState): Vec3 | undefined {
  if (!target) return undefined;
  if (target === 'home') return world.robot.home_position;
  return world.objects[target]?.position;
}

export function pointInsideZone(point: Vec3, zone: SimObject) {
  if (!zone.zone_size) return false;
  const [width, depth] = zone.zone_size;
  return (
    point[0] >= zone.position[0] - width / 2 &&
    point[0] <= zone.position[0] + width / 2 &&
    point[2] >= zone.position[2] - depth / 2 &&
    point[2] <= zone.position[2] + depth / 2
  );
}

export function pointInsideWorkspace(point: Vec3, workspace: DeviceGeometry['workspace']) {
  return (
    point[0] >= workspace.x_min &&
    point[0] <= workspace.x_max &&
    point[1] >= workspace.y_min &&
    point[1] <= workspace.y_max &&
    point[2] >= workspace.z_min &&
    point[2] <= workspace.z_max
  );
}
