import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { MotionPlan, OperationalDryRunReport, WorldState } from '@/types/simulation';
import type { SafetyReport } from '@/types/safety';
import { checkCollisions } from './CollisionChecker';
import { checkReachability } from './ReachabilityChecker';

export function runOperationalDryRun(
  deviceMeta: DeviceMeta,
  geometry: DeviceGeometry,
  world: WorldState,
  motionPlan: MotionPlan,
  safetyReport: SafetyReport
): OperationalDryRunReport {
  const reachability = checkReachability(geometry, world, motionPlan);
  const collision = checkCollisions(deviceMeta, world, motionPlan);
  const planBlocked = motionPlan.steps.some((step) => step.status === 'blocked');
  const blocked_reasons = [
    ...reachability.reasons,
    ...collision.reasons,
    ...(planBlocked ? ['motion plan contains blocked step'] : []),
    ...safetyReport.blocked_reasons
  ];

  const dry_run_status =
    blocked_reasons.length > 0
      ? 'blocked'
      : safetyReport.status === 'needs_confirmation'
        ? 'needs_confirmation'
        : 'pass';

  return {
    dry_run_status,
    profile_id: deviceMeta.profile_id,
    motion_steps_checked: motionPlan.steps.length,
    reachability_pass: reachability.pass,
    collision_pass: collision.collision_pass,
    forbidden_zone_pass: collision.forbidden_zone_pass,
    blocked_reasons: Array.from(new Set(blocked_reasons)),
    planned_path: motionPlan.steps.flatMap((step) => step.path ?? [])
  };
}
