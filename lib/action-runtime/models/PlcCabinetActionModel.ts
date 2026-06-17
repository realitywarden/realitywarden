import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan, lerp } from './modelUtils';

export class PlcCabinetActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const register = command.target ?? 'register_bank';
    const endState = { ...currentState, status: command.action === 'stop_sequence' ? 'idle' : 'completed', active_register: register, register_value: command.action === 'write_register' ? command.payload.value ?? 1 : currentState.register_value ?? 1, sequence_running: command.action === 'start_sequence' };
    return makePlan({ command, deviceMeta, geometry, currentState, endState, durationMs: 900, visual: (progress) => ({ highlighted_register: register, register_value: lerp(Number(currentState.register_value ?? 0), Number(endState.register_value ?? 1), progress), sequence_lights: [progress > 0.25, progress > 0.5, progress > 0.75] }) });
  }
}
