import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { ActionPlan } from './ActionPlan';
import type { DeviceState } from './ActionState';
import { ActionExecutor } from './ActionExecutor';
import { ActionPlanner } from './ActionPlanner';
import { makeBlockedPlan } from './models/modelUtils';

export class DeviceActionRuntime {
  private readonly planner = new ActionPlanner();
  private readonly executor = new ActionExecutor();

  createActionPlan(command: AdapterCommand, deviceMeta: DeviceMeta, geometry: DeviceGeometry, currentState: DeviceState): ActionPlan {
    return this.planner.plan(command, deviceMeta, geometry, currentState);
  }

  createBlockedActionPlan(command: AdapterCommand, deviceMeta: DeviceMeta, currentState: DeviceState, reason: string): ActionPlan {
    return makeBlockedPlan(command, deviceMeta, currentState, {
      reachable: false,
      within_constraints: false,
      collision_risk: false,
      blocked: true,
      reason
    });
  }

  executeActionPlan(plan: ActionPlan) {
    return this.executor.execute(plan);
  }
}
