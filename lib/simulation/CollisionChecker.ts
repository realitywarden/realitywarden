import type { DeviceMeta } from '@/types/deviceMeta';
import type { MotionPlan } from '@/types/simulation';
import { pointInsideZone } from './CoordinateSystem';
import type { WorldState } from '@/types/simulation';

export interface CollisionResult {
  collision_pass: boolean;
  forbidden_zone_pass: boolean;
  reasons: string[];
}

export function checkCollisions(deviceMeta: DeviceMeta, world: WorldState, motionPlan: MotionPlan): CollisionResult {
  const reasons: string[] = [];

  for (const step of motionPlan.steps) {
    if (step.target === 'outside_table') reasons.push(`${step.step_id}: target outside_table is blocked`);
    if (step.speed === 'fast') reasons.push(`${step.step_id}: speed=fast is blocked`);
    if (step.force === 'high') reasons.push(`${step.step_id}: force=high is blocked`);
    if (step.action === 'throw_object') reasons.push(`${step.step_id}: throw_object is blocked`);

    for (const point of step.path ?? []) {
      for (const zone of world.forbidden_zones) {
        if (deviceMeta.constraints.forbidden_zones.includes(zone.id) && pointInsideZone(point, zone)) {
          reasons.push(`${step.step_id}: path enters ${zone.id}`);
        }
      }
    }
  }

  const forbiddenFailures = reasons.filter((reason) => reason.includes('path enters') || reason.includes('outside_table'));

  return {
    collision_pass: reasons.length === 0,
    forbidden_zone_pass: forbiddenFailures.length === 0,
    reasons: Array.from(new Set(reasons))
  };
}
