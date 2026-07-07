import type { DeviceAsset } from '@/lib/assets/DeviceAsset';
import type { DeviceType } from '@/types/deviceMeta';

import { buildAdapterBinding, type AdapterBinding } from './AdapterBinding';
import { buildComponentGraph, type ComponentGraph } from './ComponentGraph';
import { buildDeviceManifest, type DeviceManifest } from './DeviceManifest';
import { normalizeCapabilities, type NormalizedCapability } from './CapabilityNormalizer';
import { buildRuntimePermissions, type RuntimePermission } from './RuntimePermission';
import { buildProtocolSafetyProfile, type ProtocolSafetyProfile } from './SafetyProfile';

export interface RealityAsset {
  protocol_version: 'openreality.protocol.v0.1';
  asset_id: string;
  device_type: DeviceType;
  manifest: DeviceManifest;
  component_graph: ComponentGraph;
  normalized_capabilities: NormalizedCapability[];
  safety_profile: ProtocolSafetyProfile;
  runtime_permissions: RuntimePermission[];
  adapter_binding: AdapterBinding;
  source_asset: Pick<DeviceAsset['manifest'], 'license' | 'brand' | 'source' | 'allowed_use'>;
}

export function buildRealityAsset(deviceAsset: DeviceAsset, publicAlphaRunnable: boolean): RealityAsset {
  return {
    protocol_version: 'openreality.protocol.v0.1',
    asset_id: deviceAsset.manifest.asset_id,
    device_type: deviceAsset.deviceMeta.device_type,
    manifest: buildDeviceManifest(deviceAsset.manifest, deviceAsset.deviceMeta, publicAlphaRunnable),
    component_graph: buildComponentGraph(deviceAsset.deviceMeta.device_type, deviceAsset.geometry),
    normalized_capabilities: normalizeCapabilities(deviceAsset.deviceMeta.capabilities),
    safety_profile: buildProtocolSafetyProfile(deviceAsset.deviceMeta),
    runtime_permissions: buildRuntimePermissions(deviceAsset.deviceMeta.device_type, publicAlphaRunnable),
    adapter_binding: buildAdapterBinding(deviceAsset.adapterManifest),
    source_asset: {
      license: deviceAsset.manifest.license,
      brand: deviceAsset.manifest.brand,
      source: deviceAsset.manifest.source,
      allowed_use: deviceAsset.manifest.allowed_use
    }
  };
}
