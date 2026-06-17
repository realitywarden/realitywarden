export interface AdapterResult {
  command_id: string;
  status: 'ok' | 'blocked' | 'failed';
  state_patch?: Record<string, unknown>;
  message: string;
}
