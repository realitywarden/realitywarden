import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan, targetPosition, lerp, lerpVec3, speedDuration } from './modelUtils';

export class ConveyorBeltActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const start = (currentState.item_position as [number, number, number]) ?? [-0.75, 0.45, 0];
    const end = command.action === 'sort_item' ? targetPosition(command.target, geometry) : command.action === 'start_belt' ? [0.35, 0.45, 0] as [number, number, number] : start;
    const endState =
      command.action === 'stop_belt'
        ? { ...currentState, status: 'stopped', belt_speed: 0 }
        : command.action === 'sort_item'
          ? { ...currentState, status: 'running', sorted_to: command.target, items_sorted: Number(currentState.items_sorted ?? 0) + 1, item_position: end }
          : { ...currentState, status: 'running', belt_speed: 1, item_position: end };
    return makePlan({
      command,
      deviceMeta,
      geometry,
      currentState,
      endState,
      durationMs: speedDuration(command.payload.speed, command.action === 'sort_item' ? 1400 : 850),
      visual: (progress) => ({ belt_offset: progress * 2.4, roller_rotation: progress * Math.PI * 4, belt_speed: command.action === 'stop_belt' ? lerp(1, 0, progress) : lerp(0, 1, progress), item_position: lerpVec3(start, end, progress) })
    });
  }
}
