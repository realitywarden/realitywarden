/**
 * @deprecated Superseded by `lib/hardware/` (Esp32DeviceAdapter + HardwareExecutionGate),
 * which adds honest `signalSent` semantics and safety-gated execution.
 * Kept temporarily as a reference until the four real-device acceptance
 * scenarios pass on physical hardware; delete after that validation.
 * Do NOT wire new code to this class.
 */
import type { DeviceMeta } from '@/types/deviceMeta';
import type { AdapterCommand } from './AdapterCommand';
import type { AdapterInterface } from './AdapterInterface';
import type { AdapterResult } from './AdapterResult';
import type { DeviceTransport } from './DeviceTransport';

export class RealDeviceAdapter implements AdapterInterface {
  private connected = false;

  constructor(
    private readonly deviceMeta: DeviceMeta,
    private readonly transport: DeviceTransport
  ) {}

  async connect() {
    await this.transport.open();
    this.connected = true;
  }

  async disconnect() {
    await this.transport.close();
    this.connected = false;
  }

  async getDeviceMeta() {
    return this.deviceMeta;
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterResult> {
    if (!this.connected) {
      return { command_id: command.id, status: 'failed', message: 'RealDeviceAdapter is not connected.' };
    }
    if (!command.allowed) {
      return { command_id: command.id, status: 'blocked', message: command.blocked_reason ?? 'Command is not allowed.' };
    }
    return this.transport.send(command);
  }

  async getState() {
    return this.transport.readState();
  }

  async stop() {
    return this.transport.stop();
  }

  async emergencyStop() {
    return this.transport.emergencyStop();
  }
}
