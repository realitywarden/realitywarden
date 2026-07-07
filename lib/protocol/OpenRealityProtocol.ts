import { builtInDeviceAssets } from '@/lib/assets/DeviceAssetRegistry';
import type { DeviceAsset } from '@/lib/assets/DeviceAsset';

import { buildRealityAsset, type RealityAsset } from './RealityAsset';

export const OPEN_REALITY_PROTOCOL_VERSION = 'openreality.protocol.v0.1' as const;
export const PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES = ['robot_arm', 'smart_light', 'camera_sensor'] as const;

export function isPublicAlphaRunnable(deviceAsset: DeviceAsset): boolean {
  return PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES.includes(deviceAsset.deviceMeta.device_type as (typeof PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES)[number]);
}

export function buildOpenRealityProtocolCatalog(deviceAssets: DeviceAsset[] = builtInDeviceAssets): RealityAsset[] {
  return deviceAssets.map((asset) => buildRealityAsset(asset, isPublicAlphaRunnable(asset)));
}
