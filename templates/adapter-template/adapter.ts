import deviceMeta from './device.meta.json';
import { executeAction } from './actions';
import { assertSafetyRulesPresent } from './safety.rules';

export interface AdapterTaskStep {
  id: string;
  action: string;
  target?: string;
  speed?: string;
  force?: string;
  zone?: string;
}

export interface AdapterTask {
  task_id: string;
  steps: AdapterTaskStep[];
}

export async function runAdapterTask(task: AdapterTask) {
  assertSafetyRulesPresent();

  const startedAt = new Date().toISOString();
  const steps = [];

  for (const step of task.steps) {
    if (!deviceMeta.capabilities.includes(step.action)) {
      throw new Error(`Action not supported by device meta: ${step.action}`);
    }

    const result = await executeAction({
      action: step.action as never,
      target: step.target,
      speed: step.speed as never,
      force: step.force as never,
      zone: step.zone
    });

    steps.push({
      step_id: step.id,
      action: result.action,
      target: result.target,
      status: result.status
    });
  }

  return {
    execution_id: `adapter-exec-${Date.now()}`,
    task_id: task.task_id,
    status: 'completed' as const,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    steps,
    summary: 'Adapter task completed after Safety Runtime approval.'
  };
}
