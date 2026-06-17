import type { AdapterCommand } from './AdapterCommand';
import type { AdapterResult } from './AdapterResult';
import type { DeviceTransport } from './DeviceTransport';

export class MockDeviceTransport implements DeviceTransport {
  private state: Record<string, unknown>;
  private opened = false;

  constructor(initialState: Record<string, unknown> = { status: 'idle' }) {
    this.state = { ...initialState };
  }

  async open() {
    this.opened = true;
    this.state = { ...this.state, transport: 'open' };
  }

  async close() {
    this.opened = false;
    this.state = { ...this.state, transport: 'closed' };
  }

  async send(command: AdapterCommand): Promise<AdapterResult> {
    if (!this.opened) {
      return { command_id: command.id, status: 'failed', message: 'Transport is closed.' };
    }
    this.state = {
      ...this.state,
      status: 'executed',
      last_command: command.action,
      last_target: command.target
    };
    return { command_id: command.id, status: 'ok', state_patch: this.state, message: 'Mock transport accepted command.' };
  }

  async readState() {
    return { ...this.state };
  }

  async stop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'stopped' };
    return { command_id: 'stop', status: 'ok', state_patch: this.state, message: 'Mock transport stopped.' };
  }

  async emergencyStop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'emergency_stopped' };
    return { command_id: 'emergency-stop', status: 'ok', state_patch: this.state, message: 'Mock transport emergency stopped.' };
  }
}
