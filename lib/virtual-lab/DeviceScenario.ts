import type { DeviceType } from '@/types/deviceMeta';

export interface DeviceScenario {
  id: string;
  device_profile: string;
  device_type: DeviceType;
  mode: 'safe' | 'unsafe';
  initial_state: Record<string, unknown>;
  prompt: string;
  expected_task_type: string;
  unsafe_actions: string[];
  expected_safety_result: 'pass' | 'blocked';
  expected_state_after: Record<string, unknown>;
}
