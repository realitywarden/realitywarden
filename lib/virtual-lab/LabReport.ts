import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { ActionPlanSummary } from '@/lib/action-runtime/ActionPlan';
import type { Goal, RuntimeDecisionStatus, SafetyDecision } from '@/lib/open-reality-runtime/types';
import type { RuntimeAuditEntry } from '@/lib/runtime/RuntimeAuditLog';
import type { ActionFrame } from '@/lib/action-runtime/ActionState';
import type { SafetyReport } from '@/types/safety';
import type { TaskDSL } from '@/types/taskDsl';

export interface ExecutionTimelineEvent {
  id: string;
  timestamp_ms: number;
  stage: 'compile' | 'safety' | 'adapter' | 'device' | 'report';
  message: string;
}

export interface LabReport {
  lab_run_id: string;
  device_profile: string;
  scenario: string;
  prompt: string;
  status: RuntimeDecisionStatus | 'proposed_plan';
  created_at: string;
  target_device: {
    device_id: string;
    device_type: string;
    profile_id: string;
    display_name: string;
  };
  goal: Goal | null;
  capabilities: {
    required: string[];
    missing: string[];
  };
  safety_decision: SafetyDecision;
  execution_mode: 'simulation_only' | 'read_only' | 'ask_human' | 'blocked';
  reason: string;
  user_facing_message: string;
  task_dsl: TaskDSL;
  runtime_audit_log: RuntimeAuditEntry[];
  safety_report: SafetyReport;
  adapter_commands: AdapterCommand[];
  action_plans: ActionPlanSummary[];
  device_state_before: Record<string, unknown>;
  device_state_after: Record<string, unknown>;
  execution_timeline: ExecutionTimelineEvent[];
  state_snapshots?: TimelineStateSnapshot[];
  result: 'pass' | 'blocked' | 'failed';
}

export interface TimelineStateSnapshot {
  step_index: number;
  step_id: string;
  command_id?: string;
  stage: 'initial' | 'compile' | 'safety' | 'adapter' | 'device' | 'blocked' | 'final';
  safety_status: 'idle' | 'pass' | 'blocked' | 'needs_confirmation';
  safety_report: SafetyReport;
  device_state: Record<string, unknown>;
  action_frame?: ActionFrame;
  changed_keys: string[];
  message: string;
  timestamp_ms: number;
}
