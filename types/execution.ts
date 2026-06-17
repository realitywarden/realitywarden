import type { AdapterCommand, MotionPlan, OperationalDryRunReport, TimelineEvent } from './simulation';

export interface ExecutionReport {
  execution_id: string;
  task_id: string;
  status: 'idle' | 'blocked' | 'executing' | 'completed' | 'failed';
  profile_id?: string;
  dry_run: DryRunReport;
  dry_run_report?: OperationalDryRunReport;
  motion_plan?: MotionPlan;
  adapter_commands?: AdapterCommand[];
  timeline?: TimelineEvent[];
  started_at?: string;
  finished_at?: string;
  steps: ExecutionStepReport[];
  summary: string;
}

export interface DryRunReport {
  dry_run_status: 'pass' | 'blocked';
  checked_profile: string;
  checked_workspace: boolean;
  checked_forbidden_zones: boolean;
  checked_path: boolean;
}

export interface ExecutionStepReport {
  step_id: string;
  action: string;
  target?: string;
  status: 'pending' | 'running' | 'completed' | 'blocked' | 'failed';
  reason?: string;
}
