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
