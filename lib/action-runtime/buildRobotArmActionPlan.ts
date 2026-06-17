import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { ActionPlan } from './ActionPlan';
import type { DeviceState } from './ActionState';
import { DeviceActionRuntime } from './DeviceActionRuntime';
import { targetPosition } from './TargetResolver';

export function buildRobotArmActionPlan({
  command,
  deviceMeta,
  geometry,
  stateBefore,
  deviceInstanceId = 'workspace-robot-arm'
}: {
  command: AdapterCommand;
  deviceMeta: DeviceMeta;
  geometry: DeviceGeometry;
  stateBefore: DeviceState;
  deviceInstanceId?: string;
}): ActionPlan & { plan_id: string; device_instance_id: string; state_before: DeviceState; state_after: DeviceState } {
  if (command.action !== 'move_to_pose') {
    const blocked = new DeviceActionRuntime().createBlockedActionPlan(command, deviceMeta, stateBefore, 'Robot Arm playback prototype only supports move_to_pose.');
    return withAliases(blocked, deviceInstanceId);
  }

  const target = targetPosition(command.target, geometry);
  const start = (stateBefore.gripper_position as [number, number, number]) ?? [0.82, 1.38, 0];
  const plan = new DeviceActionRuntime().createActionPlan(command, deviceMeta, geometry, stateBefore);
  return withAliases({
    ...plan,
    frames: plan.frames.map((frame) => ({
      ...frame,
      visual_state: {
        ...frame.visual_state,
        end_effector_position: frame.visual_state.gripper_position ?? start,
        target_position: target,
        joint_hint: {
          shoulder: Array.isArray(frame.visual_state.joint_angles) ? frame.visual_state.joint_angles[0] : 0,
          elbow: Array.isArray(frame.visual_state.joint_angles) ? frame.visual_state.joint_angles[1] : 0
        },
        path_points: [start, target]
      }
    }))
  }, deviceInstanceId);
}

function withAliases(plan: ActionPlan, deviceInstanceId: string) {
  return {
    ...plan,
    plan_id: plan.action_plan_id,
    device_instance_id: deviceInstanceId,
    state_before: plan.start_state,
    state_after: plan.end_state
  };
}
