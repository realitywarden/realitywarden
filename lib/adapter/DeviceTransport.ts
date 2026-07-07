/**
 * @deprecated Superseded by `lib/hardware/RealDeviceTransport`, which has
 * explicit connectivity semantics (isConnected + TransportOfflineError).
 * Only the deprecated RealDeviceAdapter/MockDeviceTransport use this
 * interface. Delete together with them after real-device validation.
 */
import type { AdapterCommand } from './AdapterCommand';
import type { AdapterResult } from './AdapterResult';

export interface DeviceTransport {
  open(): Promise<void>;
  close(): Promise<void>;
  send(command: AdapterCommand): Promise<AdapterResult>;
  readState(): Promise<Record<string, unknown>>;
  stop(): Promise<AdapterResult>;
  emergencyStop(): Promise<AdapterResult>;
}
