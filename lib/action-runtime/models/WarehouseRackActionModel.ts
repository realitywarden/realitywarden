import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { makePlan } from './modelUtils';

export class WarehouseRackActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const slot = command.target ?? 'rack_slot_a1';
    const reserved = command.action === 'reserve_slot' ? slot : command.action === 'release_slot' ? null : currentState.reserved_slot;
    const endState = { ...currentState, status: 'completed', active_slot: slot, reserved_slot: reserved, marked_item: command.action === 'mark_item' ? slot : currentState.marked_item };
    return makePlan({ command, deviceMeta, geometry, currentState, endState, durationMs: 850, visual: (progress) => ({ scanning_progress: command.action === 'scan_slot' ? progress : undefined, highlighted_slot: slot, reserved_slot: reserved }) });
  }
}
