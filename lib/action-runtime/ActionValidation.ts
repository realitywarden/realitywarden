import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { ActionValidation } from './ActionPlan';
import { planWorkspacePath } from './CollisionPathPlanner';
import { solvePlanarTwoLinkIk } from './Kinematics';
import { targetPosition } from './TargetResolver';

export function validateCommandForAction(command: AdapterCommand, deviceMeta: DeviceMeta, geometry: DeviceGeometry): ActionValidation {
  if (!command.allowed) {
    return { reachable: false, within_constraints: false, collision_risk: false, blocked: true, reason: command.blocked_reason ?? 'Command is blocked.' };
  }
  const target = command.target;
  const forbidden = Boolean(target && deviceMeta.constraints.forbidden_zones.includes(target));
  const known = !target || deviceMeta.constraints.known_targets?.includes(target) || Boolean(geometry.zones[target]) || Boolean(geometry.objects[target as keyof typeof geometry.objects]);
  const position = targetPosition(target, geometry);
  const inWorkspace = position[0] >= geometry.workspace.x_min && position[0] <= geometry.workspace.x_max
    && position[1] >= geometry.workspace.y_min && position[1] <= geometry.workspace.y_max
    && position[2] >= geometry.workspace.z_min && position[2] <= geometry.workspace.z_max;
  const ik = deviceMeta.device_type === 'robot_arm' && target ? solvePlanarTwoLinkIk(position, geometry) : null;
  const path = deviceMeta.device_type === 'mobile_robot' && target ? planWorkspacePath(
    (deviceMeta.runtime_state.current_position && targetPosition(deviceMeta.runtime_state.current_position, geometry)) || [0, 0, 0],
    position,
    geometry
  ) : null;
  const reachable = known && inWorkspace && (!ik || ik.reachable);
  const collisionRisk = forbidden || Boolean(path?.collision_risk);
  const blocked = forbidden || !known || !inWorkspace || Boolean(ik && !ik.reachable);
  return {
    reachable,
    within_constraints: !forbidden && inWorkspace,
    collision_risk: collisionRisk,
    blocked,
    reason: forbidden
      ? `Target ${target} is forbidden by device constraints.`
      : !known
        ? `Target ${target} is not declared in device geometry or known targets.`
        : !inWorkspace
          ? `Target ${target} is outside workspace constraints.`
          : ik && !ik.reachable
            ? `Target ${target} is outside robot arm reach.`
            : undefined,
    diagnostics: {
      target_position: position,
      ik,
      path
    }
  };
}
