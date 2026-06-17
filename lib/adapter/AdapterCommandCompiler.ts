import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskDSL, TaskStep } from '@/types/taskDsl';
import type { AdapterCommand } from './AdapterCommand';

export function createAdapterCommand(deviceMeta: DeviceMeta, step: TaskStep): AdapterCommand {
  const allowed = step.action !== 'throw_object' && deviceMeta.capabilities.some((capability) => capability === step.action);
  return {
    id: `cmd-${step.id}`,
    source_step_id: step.id,
    action: step.action,
    target: step.target,
    payload: {
      speed: step.speed,
      force: step.force,
      value: step.value,
      zone: step.zone
    },
    allowed,
    blocked_reason: allowed ? undefined : `Action ${step.action} is not supported by ${deviceMeta.profile_id}.`
  };
}

export function createAdapterCommands(deviceMeta: DeviceMeta, taskDsl: TaskDSL) {
  return taskDsl.steps.map((step) => createAdapterCommand(deviceMeta, step));
}
