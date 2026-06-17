import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { ActionPlan } from './ActionPlan';
import type { DeviceState } from './ActionState';

export interface DeviceActionContext {
  command: AdapterCommand;
  deviceMeta: DeviceMeta;
  geometry: DeviceGeometry;
  currentState: DeviceState;
}

export interface DeviceActionModel {
  plan(context: DeviceActionContext): ActionPlan;
}
