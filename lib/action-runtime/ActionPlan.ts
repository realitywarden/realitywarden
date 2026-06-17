import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceType } from '@/types/deviceMeta';
import type { ActionFrame, DeviceState } from './ActionState';

export interface ActionValidation {
  reachable: boolean;
  within_constraints: boolean;
  collision_risk: boolean;
  blocked?: boolean;
  reason?: string;
  diagnostics?: Record<string, unknown>;
}

export interface ActionPlan {
  action_plan_id: string;
  command_id: string;
  device_type: DeviceType;
  action: AdapterCommand['action'];
  target?: string;
  start_state: DeviceState;
  end_state: DeviceState;
  duration_ms: number;
  frames: ActionFrame[];
  validation: ActionValidation;
}

export interface ActionPlanSummary {
  action_plan_id: string;
  command_id: string;
  action: AdapterCommand['action'];
  target?: string;
  duration_ms: number;
  validation: ActionValidation;
  start_state: DeviceState;
  end_state: DeviceState;
  frame_count: number;
}

export function summarizeActionPlan(plan: ActionPlan): ActionPlanSummary {
  return {
    action_plan_id: plan.action_plan_id,
    command_id: plan.command_id,
    action: plan.action,
    target: plan.target,
    duration_ms: plan.duration_ms,
    validation: plan.validation,
    start_state: plan.start_state,
    end_state: plan.end_state,
    frame_count: plan.frames.length
  };
}
