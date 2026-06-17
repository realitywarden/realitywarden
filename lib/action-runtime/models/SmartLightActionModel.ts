import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan, lerp } from './modelUtils';

export class SmartLightActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const fromBrightness = Number(currentState.brightness ?? 0);
    const toBrightness = command.action === 'set_brightness' ? Number(command.payload.value ?? 0) : command.action === 'set_light' ? (command.payload.value ? 45 : 0) : fromBrightness;
    const fromColor = String(currentState.color ?? 'neutral');
    const toColor = command.action === 'set_color' ? String(command.payload.value ?? 'neutral') : fromColor;
    const endState = { ...currentState, status: toBrightness > 0 || command.action === 'set_color' ? 'on' : 'off', brightness: toBrightness, color: toColor };
    return makePlan({
      command,
      deviceMeta,
      geometry,
      currentState,
      endState,
      durationMs: 900,
      visual: (progress) => ({ brightness: lerp(fromBrightness, toBrightness, progress), color_from: fromColor, color: progress >= 1 ? toColor : fromColor, transition_progress: progress })
    });
  }
}
