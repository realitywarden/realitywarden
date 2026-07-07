import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { AdapterInterface } from '@/lib/adapter/AdapterInterface';
import type { AdapterResult } from '@/lib/adapter/AdapterResult';
import type { DeviceMeta } from '@/types/deviceMeta';

const PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES = new Set(["robot_arm","camera_sensor","smart_light"]);

export class SimulationOnlyAdapterStub implements AdapterInterface {
  constructor(
    private readonly deviceMeta: DeviceMeta,
    private readonly initialState: Record<string, unknown> = { status: 'idle' }
  ) {}

  private connected = false;
  private state = { ...this.initialState };

  async connect(): Promise<void> {
    if (!PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES.has(this.deviceMeta.device_type)) {
      throw new Error(`${this.deviceMeta.device_type} is protocol-only in Public Alpha.`);
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getDeviceMeta(): Promise<DeviceMeta> {
    return this.deviceMeta;
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterResult> {
    if (!this.connected) {
      return { command_id: command.id, status: 'failed', message: 'Adapter is not connected.' };
    }
    if (!command.allowed) {
      return { command_id: command.id, status: 'blocked', message: command.blocked_reason ?? 'Command blocked before adapter execution.' };
    }
    this.state = {
      ...this.state,
      status: 'executed',
      last_command: command.action,
      last_target: command.target,
      runtime_mode: 'simulation-only'
    };
    return {
      command_id: command.id,
      status: 'ok',
      state_patch: this.state,
      message: 'SimulationOnlyAdapterStub accepted a Public Alpha simulation command.'
    };
  }

  async getState(): Promise<Record<string, unknown>> {
    return { ...this.state };
  }

  async stop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'stopped' };
    return { command_id: 'stop', status: 'ok', state_patch: this.state, message: 'Simulation adapter stopped.' };
  }

  async emergencyStop(): Promise<AdapterResult> {
    this.state = { ...this.state, status: 'emergency_stopped' };
    return { command_id: 'emergency-stop', status: 'ok', state_patch: this.state, message: 'Simulation adapter emergency stopped.' };
  }
}
