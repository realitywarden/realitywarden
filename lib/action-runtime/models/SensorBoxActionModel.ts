import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import type { DeviceState } from '../ActionState';
import { makePlan, lerp } from './modelUtils';

export class SensorBoxActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const endState: DeviceState = command.action === 'reset_sensor'
      ? { ...currentState, status: 'idle', sensor_value: 0, calibrated: false }
      : command.action === 'calibrate_sensor'
        ? { ...currentState, status: 'calibrated', calibrated: true, calibration_progress: 1 }
        : { ...currentState, status: 'sampled', sensor_value: 52.5 };
    return makePlan({ command, deviceMeta, geometry, currentState, endState, durationMs: 780, visual: (progress) => ({ waveform_value: Math.sin(progress * Math.PI * 4), sensor_value: lerp(Number(currentState.sensor_value ?? 0), Number(endState.sensor_value ?? 52.5), progress), calibration_progress: command.action === 'calibrate_sensor' ? progress : undefined }) });
  }
}
