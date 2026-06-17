import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { DryRunReport } from '@/types/execution';
import type { SafetyReport } from '@/types/safety';
import type { TaskDSL } from '@/types/taskDsl';

function targetInsideWorkspace(target: [number, number, number] | undefined, geometry: DeviceGeometry) {
  if (!target) return true;
  const [x, y, z] = target;
  return (
    x >= geometry.workspace.x_min &&
    x <= geometry.workspace.x_max &&
    y >= geometry.workspace.y_min &&
    y <= geometry.workspace.y_max &&
    z >= geometry.workspace.z_min &&
    z <= geometry.workspace.z_max
  );
}

function resolveTargetPosition(target: string | undefined, geometry: DeviceGeometry): [number, number, number] | undefined {
  if (!target) return undefined;
  if (target === 'red_cube') return geometry.objects.red_cube.position;
  if (target === 'blue_cube') return geometry.objects.blue_cube.position;
  if (target === 'glass_cup') return geometry.objects.glass_cup.position;
  if (target in geometry.zones) return geometry.zones[target].position;
  return undefined;
}

export function runSimulatorDryRun(
  deviceMeta: DeviceMeta,
  geometry: DeviceGeometry,
  task: TaskDSL,
  safety: SafetyReport
): DryRunReport {
  const checkedWorkspace = task.steps.every((step) => targetInsideWorkspace(resolveTargetPosition(step.target, geometry), geometry));
  const checkedForbiddenZones = task.steps.every(
    (step) =>
      !deviceMeta.constraints.forbidden_zones.includes(step.target ?? '') &&
      !deviceMeta.constraints.forbidden_zones.includes(step.zone ?? '')
  );
  const checkedPath = safety.status === 'pass' && checkedWorkspace && checkedForbiddenZones;

  return {
    dry_run_status: checkedPath ? 'pass' : 'blocked',
    checked_profile: deviceMeta.profile_id,
    checked_workspace: checkedWorkspace,
    checked_forbidden_zones: checkedForbiddenZones,
    checked_path: checkedPath
  };
}
