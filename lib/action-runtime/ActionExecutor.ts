import type { ActionPlan } from './ActionPlan';
import type { DeviceState } from './ActionState';

export class ActionExecutor {
  execute(plan: ActionPlan): DeviceState {
    if (plan.validation.blocked || plan.frames.length === 0) return plan.start_state;
    return plan.end_state;
  }
}
