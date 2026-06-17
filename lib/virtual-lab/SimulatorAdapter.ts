import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { AdapterInterface } from '@/lib/adapter/AdapterInterface';
import type { AdapterResult } from '@/lib/adapter/AdapterResult';
import { createAdapterCommand } from '@/lib/adapter/AdapterCommandCompiler';
import { DeviceActionRuntime } from '@/lib/action-runtime/DeviceActionRuntime';
import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskStep } from '@/types/taskDsl';
import { VirtualDeviceInstance } from './VirtualDeviceInstance';

export class SimulatorAdapter implements AdapterInterface {
  private connected = false;
  private readonly actionRuntime = new DeviceActionRuntime();

  constructor(private readonly instance: VirtualDeviceInstance) {}

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async getDeviceMeta(): Promise<DeviceMeta> {
    return this.instance.deviceMeta;
  }

  async getState() {
    return this.instance.getState();
  }

  createCommand(step: TaskStep): AdapterCommand {
    return createAdapterCommand(this.instance.deviceMeta, step);
  }

  async executeCommand(command: AdapterCommand): Promise<AdapterResult> {
    if (!this.connected) {
      return { command_id: command.id, status: 'failed', message: 'Adapter is not connected.' };
    }
    if (!command.allowed) {
      return { command_id: command.id, status: 'blocked', message: command.blocked_reason ?? 'Command is not allowed.' };
    }

    const currentState = this.instance.getState();
    const plan = this.actionRuntime.createActionPlan(command, this.instance.deviceMeta, this.instance.geometry, currentState);
    if (plan.validation.blocked) {
      return { command_id: command.id, status: 'blocked', message: plan.validation.reason ?? 'Action plan is blocked.' };
    }
    const nextState = this.actionRuntime.executeActionPlan(plan);
    this.instance.patchState(nextState);
    return { command_id: command.id, status: 'ok', state_patch: nextState, message: `${command.action} applied through ${plan.action_plan_id}.` };
  }

  async stop(): Promise<AdapterResult> {
    this.instance.patchState({ status: 'stopped' });
    return { command_id: 'stop', status: 'ok', message: 'Simulator stopped.' };
  }

  async emergencyStop(): Promise<AdapterResult> {
    this.instance.patchState({ status: 'emergency_stopped' });
    return { command_id: 'emergency-stop', status: 'ok', message: 'Emergency stop applied.' };
  }

}
