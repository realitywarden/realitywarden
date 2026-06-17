import type { DeviceGeometry } from '@/types/deviceMeta';

export interface TwoLinkIkResult {
  reachable: boolean;
  shoulder: number;
  elbow: number;
  wrist: [number, number, number];
  reach: number;
  max_reach: number;
}

export function solvePlanarTwoLinkIk(target: [number, number, number], geometry: DeviceGeometry): TwoLinkIkResult {
  const [baseX, baseY, baseZ] = geometry.robot.base_position;
  const [upper, lower] = geometry.robot.arm_segments;
  const dx = target[0] - baseX;
  const dz = target[2] - baseZ;
  const dy = Math.max(0.05, target[1] - baseY);
  const radial = Math.hypot(dx, dz);
  const reach = Math.hypot(radial, dy);
  const maxReach = upper + lower + geometry.robot.gripper_size;
  const clampedReach = Math.min(Math.max(reach, 0.001), upper + lower - 0.001);
  const cosElbow = clamp((upper * upper + lower * lower - clampedReach * clampedReach) / (2 * upper * lower), -1, 1);
  const elbow = Math.PI - Math.acos(cosElbow);
  const cosShoulder = clamp((upper * upper + clampedReach * clampedReach - lower * lower) / (2 * upper * clampedReach), -1, 1);
  const shoulder = Math.atan2(dy, radial) - Math.acos(cosShoulder);

  return {
    reachable: reach <= maxReach,
    shoulder,
    elbow,
    wrist: target,
    reach,
    max_reach: maxReach
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
