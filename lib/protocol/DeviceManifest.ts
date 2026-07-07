import type { DeviceAssetManifest } from '@/lib/assets/DeviceAsset';
import type { DeviceMeta, DeviceType } from '@/types/deviceMeta';

export interface DeviceManifest {
  protocol_version: 'openreality.protocol.v0.1';
  manifest_version: 'device-manifest.v1';
  asset_id: string;
  profile_id: string;
  device_id: string;
  device_type: DeviceType;
  display_name: string;
  manufacturer: string;
  model: string;
  category: string;
  simulator_fidelity: 'semantic' | 'kinematic' | 'physics';
  risk_class: 'low' | 'medium' | 'high';
  supported_adapters: string[];
  public_alpha_runnable: boolean;
}

export function buildDeviceManifest(
  manifest: DeviceAssetManifest,
  deviceMeta: DeviceMeta,
  publicAlphaRunnable: boolean
): DeviceManifest {
  return {
    protocol_version: 'openreality.protocol.v0.1',
    manifest_version: 'device-manifest.v1',
    asset_id: manifest.asset_id,
    profile_id: deviceMeta.profile_id,
    device_id: deviceMeta.device_id,
    device_type: deviceMeta.device_type,
    display_name: deviceMeta.display_name,
    manufacturer: deviceMeta.manufacturer,
    model: deviceMeta.model,
    category: manifest.category,
    simulator_fidelity: deviceMeta.simulator_fidelity?.level ?? manifest.simulator_fidelity ?? 'semantic',
    risk_class: deviceMeta.risk_class,
    supported_adapters: deviceMeta.supported_adapters,
    public_alpha_runnable: publicAlphaRunnable
  };
}
