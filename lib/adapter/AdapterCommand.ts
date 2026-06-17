import type { TaskStep } from '@/types/taskDsl';

export interface AdapterCommand {
  id: string;
  source_step_id: string;
  action: TaskStep['action'];
  target?: string;
  payload: Record<string, unknown>;
  allowed: boolean;
  blocked_reason?: string;
}
