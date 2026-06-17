import type { DeviceMeta } from '@/types/deviceMeta';
import type { AdapterCommand } from './AdapterCommand';
import type { AdapterResult } from './AdapterResult';

export interface AdapterInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getDeviceMeta(): Promise<DeviceMeta>;
  executeCommand(command: AdapterCommand): Promise<AdapterResult>;
  getState(): Promise<Record<string, unknown>>;
  stop(): Promise<AdapterResult>;
  emergencyStop(): Promise<AdapterResult>;
}
