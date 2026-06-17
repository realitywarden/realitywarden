import type { DeviceGeometry } from '@/types/deviceMeta';

export interface PlannedPath {
  waypoints: [number, number, number][];
  distance: number;
  collision_risk: boolean;
  reason?: string;
}

export function planWorkspacePath(start: [number, number, number], end: [number, number, number], geometry: DeviceGeometry): PlannedPath {
  const within = isInsideWorkspace(start, geometry) && isInsideWorkspace(end, geometry);
  const obstacleZones = Object.entries(geometry.zones)
    .filter(([id]) => id.includes('restricted') || id.includes('forbidden') || id.includes('hazard'));
  const blockingZone = obstacleZones.find(([, zone]) => lineIntersectsZone(start, end, zone.position, zone.size));
  const waypoints = blockingZone
    ? [start, detourPoint(start, end, blockingZone[1].position, blockingZone[1].size, geometry), end]
    : [start, end];
  return {
    waypoints,
    distance: pathDistance(waypoints),
    collision_risk: !within || Boolean(blockingZone),
    reason: !within ? 'Path endpoint is outside workspace.' : blockingZone ? `Path intersects restricted zone ${blockingZone[0]}.` : undefined
  };
}

export function samplePath(waypoints: [number, number, number][], progress: number): [number, number, number] {
  if (waypoints.length <= 1) return waypoints[0] ?? [0, 0, 0];
  const total = pathDistance(waypoints);
  if (total <= 0) return waypoints[waypoints.length - 1];
  let remaining = total * progress;
  for (let index = 0; index < waypoints.length - 1; index += 1) {
    const a = waypoints[index];
    const b = waypoints[index + 1];
    const segment = distance(a, b);
    if (remaining <= segment) {
      const t = segment <= 0 ? 1 : remaining / segment;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }
    remaining -= segment;
  }
  return waypoints[waypoints.length - 1];
}

function isInsideWorkspace(point: [number, number, number], geometry: DeviceGeometry) {
  return point[0] >= geometry.workspace.x_min && point[0] <= geometry.workspace.x_max
    && point[1] >= geometry.workspace.y_min && point[1] <= geometry.workspace.y_max
    && point[2] >= geometry.workspace.z_min && point[2] <= geometry.workspace.z_max;
}

function lineIntersectsZone(start: [number, number, number], end: [number, number, number], center: [number, number, number], size: [number, number]) {
  const samples = 18;
  const [width, depth] = size;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const x = start[0] + (end[0] - start[0]) * t;
    const z = start[2] + (end[2] - start[2]) * t;
    if (Math.abs(x - center[0]) <= width / 2 && Math.abs(z - center[2]) <= depth / 2) return true;
  }
  return false;
}

function detourPoint(start: [number, number, number], end: [number, number, number], center: [number, number, number], size: [number, number], geometry: DeviceGeometry): [number, number, number] {
  const side = start[0] <= end[0] ? -1 : 1;
  const margin = 0.28;
  const x = clamp(center[0] + side * (size[0] / 2 + margin), geometry.workspace.x_min, geometry.workspace.x_max);
  const z = clamp(center[2] + size[1] / 2 + margin, geometry.workspace.z_min, geometry.workspace.z_max);
  return [x, start[1], z];
}

function pathDistance(points: [number, number, number][]) {
  return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

function distance(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
