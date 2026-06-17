export type DeviceState = Record<string, unknown>;
export type VisualState = Record<string, unknown>;

export interface ActionFrame {
  time_ms: number;
  progress: number;
  device_state: DeviceState;
  visual_state: VisualState;
  command_id: string;
  status: 'running' | 'completed' | 'blocked';
}
