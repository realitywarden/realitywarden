import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan, lerp } from './modelUtils';

export class LabInstrumentActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const value = command.action === 'read_measurement' ? 73.4 : Number(command.payload.value ?? currentState.parameter_value ?? 1);
    const endState = { ...currentState, status: command.action === 'stop_test' ? 'idle' : command.action === 'start_test' ? 'running' : 'completed', parameter_value: value, measurement_value: command.action === 'read_measurement' ? value : currentState.measurement_value };
    return makePlan({ command, deviceMeta, geometry, currentState, endState, durationMs: 1000, visual: (progress) => ({ screen_status: endState.status, measurement_value: lerp(Number(currentState.measurement_value ?? 0), Number(endState.measurement_value ?? value), progress), test_progress: command.action === 'start_test' ? progress : undefined }) });
  }
}
