import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';

export class VirtualDeviceInstance {
  readonly id: string;
  readonly deviceMeta: DeviceMeta;
  readonly geometry: DeviceGeometry;
  private state: Record<string, unknown>;

  constructor(id: string, deviceMeta: DeviceMeta, geometry: DeviceGeometry, initialState: Record<string, unknown>) {
    this.id = id;
    this.deviceMeta = deviceMeta;
    this.geometry = geometry;
    this.state = { ...initialState };
  }

  getState() {
    return { ...this.state };
  }

  patchState(patch: Record<string, unknown>) {
    this.state = { ...this.state, ...patch };
    return this.getState();
  }
}
