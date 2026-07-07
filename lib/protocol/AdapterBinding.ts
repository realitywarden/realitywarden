import type { AdapterManifest } from '@/lib/assets/DeviceAsset';

export interface AdapterBinding {
  binding_version: 'adapter-binding.v1';
  adapter_id: string;
  adapter_type: string;
  interface: string;
  transport: string;
  supported_commands: string[];
  real_device_enabled: boolean;
}

export function buildAdapterBinding(adapterManifest: AdapterManifest): AdapterBinding {
  return {
    binding_version: 'adapter-binding.v1',
    adapter_id: adapterManifest.adapter_id,
    adapter_type: adapterManifest.adapter_type,
    interface: adapterManifest.interface,
    transport: adapterManifest.transport,
    supported_commands: adapterManifest.supported_commands,
    real_device_enabled: adapterManifest.real_device_enabled
  };
}
