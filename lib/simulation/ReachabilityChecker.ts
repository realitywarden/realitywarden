import type { DeviceGeometry } from '@/types/deviceMeta';
import type { MotionPlan, Vec3, WorldState } from '@/types/simulation';
import { distance, pointInsideWorkspace } from './CoordinateSystem';

export interface ReachabilityResult {
  pass: boolean;
  reasons: string[];
}

function targetReachable(target: Vec3, geometry: DeviceGeometry, world: WorldState) {
  const maxReach = geometry.robot.arm_segments[0] + geometry.robot.arm_segments[1] + geometry.robot.gripper_size;
  const baseDistance = distance(world.robot.base_position, target);
  const insideWorkspace = pointInsideWorkspace(target, geometry.workspace);
  const heightReasonable = target[1] >= geometry.workspace.y_min && target[1] <= geometry.workspace.y_max;
  return {
    pass: insideWorkspace && heightReasonable && baseDistance <= maxReach,
    baseDistance,
    maxReach,
    insideWorkspace,
    heightReasonable
  };
}

export function checkReachability(geometry: DeviceGeometry, world: WorldState, motionPlan: MotionPlan): ReachabilityResult {
  const reasons: string[] = [];

  for (const step of motionPlan.steps) {
    if (!step.target_position) continue;
    const result = targetReachable(step.target_position, geometry, world);
    if (!result.insideWorkspace) reasons.push(`${step.step_id}: target outside workspace`);
    if (!result.heightReasonable) reasons.push(`${step.step_id}: target height outside workspace`);
    if (result.baseDistance > result.maxReach) reasons.push(`${step.step_id}: target outside arm reach`);
  }

  for (const zoneId of ['left_safe_zone', 'right_safe_zone']) {
    const zone = world.objects[zoneId];
    if (!zone) continue;
    const result = targetReachable(zone.position, geometry, world);
    if (!result.pass) reasons.push(`${zoneId}: safe zone is not reachable`);
  }

  return { pass: reasons.length === 0, reasons };
}
