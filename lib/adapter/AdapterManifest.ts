import type { DeviceCapability, DeviceType } from '@/types/deviceMeta';

export interface AdapterManifest {
  adapter_id: string;
  adapter_type: 'simulator' | 'real_device';
  device_type: DeviceType;
  protocol_version: string;
  supported_capabilities: DeviceCapability[];
}
