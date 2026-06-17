import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import { frameProgress, lerp, lerpVec3, speedDuration } from '../ActionInterpolator';
import type { ActionPlan, ActionValidation } from '../ActionPlan';
import type { DeviceState, VisualState } from '../ActionState';
import { validateCommandForAction } from '../ActionValidation';
export { targetPosition } from '../TargetResolver';

export function makeBlockedPlan(command: AdapterCommand, deviceMeta: DeviceMeta, currentState: DeviceState, validation: ActionValidation): ActionPlan {
  return {
    action_plan_id: `plan-${command.id}`,
    command_id: command.id,
    device_type: deviceMeta.device_type,
    action: command.action,
    target: command.target,
    start_state: currentState,
    end_state: currentState,
    duration_ms: 0,
    frames: [],
    validation
  };
}

export function makePlan({
  command,
  deviceMeta,
  geometry,
  currentState,
  endState,
  durationMs,
  visual
}: {
  command: AdapterCommand;
  deviceMeta: DeviceMeta;
  geometry: DeviceGeometry;
  currentState: DeviceState;
  endState: DeviceState;
  durationMs?: number;
  visual: (progress: number) => VisualState;
}): ActionPlan {
  const validation = validateCommandForAction(command, deviceMeta, geometry);
  if (validation.blocked) return makeBlockedPlan(command, deviceMeta, currentState, validation);
  const duration = durationMs ?? speedDuration(command.payload.speed, 1200);
  const frames = frameProgress(Math.max(2, Math.ceil(duration / 120) + 1)).map((progress) => ({
    time_ms: Math.round(duration * progress),
    progress,
    device_state: progress >= 1 ? endState : { ...currentState, status: 'executing' },
    visual_state: visual(progress),
    command_id: command.id,
    status: progress >= 1 ? 'completed' as const : 'running' as const
  }));
  return {
    action_plan_id: `plan-${command.id}`,
    command_id: command.id,
    device_type: deviceMeta.device_type,
    action: command.action,
    target: command.target,
    start_state: currentState,
    end_state: endState,
    duration_ms: duration,
    frames,
    validation
  };
}

export { lerp, lerpVec3, speedDuration };
