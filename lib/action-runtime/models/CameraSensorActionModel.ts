import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan, lerp } from './modelUtils';

export class CameraSensorActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const frames = Number(currentState.frames_captured ?? 0);
    const endState = command.action === 'capture_frame'
      ? { ...currentState, status: 'captured', last_capture_target: command.target, frames_captured: frames + 1 }
      : { ...currentState, status: 'sampled', last_sensor_target: command.target, sensor_value: 42 };
    return makePlan({
      command,
      deviceMeta,
      geometry,
      currentState,
      endState,
      durationMs: command.action === 'capture_frame' ? 850 : 650,
      visual: (progress) => ({ scan_angle: lerp(-24, 24, progress), capture_flash: command.action === 'capture_frame' ? Math.sin(progress * Math.PI) : 0, sensor_value: lerp(Number(currentState.sensor_value ?? 0), 42, progress) })
    });
  }
}
