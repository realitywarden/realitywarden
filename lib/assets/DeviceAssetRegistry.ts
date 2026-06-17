import type { DeviceAsset } from './DeviceAsset';
import { validateDeviceAsset } from './DeviceAssetValidator';

import robotArmManifest from '@/assets/devices/generic-industrial-robot-arm/asset.manifest.json';
import robotArmMeta from '@/assets/devices/generic-industrial-robot-arm/device.meta.json';
import robotArmGeometry from '@/assets/devices/generic-industrial-robot-arm/geometry.json';
import robotArmAdapter from '@/assets/devices/generic-industrial-robot-arm/adapter.manifest.json';
import robotArmSafe from '@/assets/devices/generic-industrial-robot-arm/scenarios/safe.json';
import robotArmUnsafe from '@/assets/devices/generic-industrial-robot-arm/scenarios/unsafe.json';

import agvManifest from '@/assets/devices/generic-agv-mobile-robot/asset.manifest.json';
import agvMeta from '@/assets/devices/generic-agv-mobile-robot/device.meta.json';
import agvGeometry from '@/assets/devices/generic-agv-mobile-robot/geometry.json';
import agvAdapter from '@/assets/devices/generic-agv-mobile-robot/adapter.manifest.json';
import agvSafe from '@/assets/devices/generic-agv-mobile-robot/scenarios/safe.json';
import agvUnsafe from '@/assets/devices/generic-agv-mobile-robot/scenarios/unsafe.json';

import ptzManifest from '@/assets/devices/generic-ptz-camera/asset.manifest.json';
import ptzMeta from '@/assets/devices/generic-ptz-camera/device.meta.json';
import ptzGeometry from '@/assets/devices/generic-ptz-camera/geometry.json';
import ptzAdapter from '@/assets/devices/generic-ptz-camera/adapter.manifest.json';
import ptzSafe from '@/assets/devices/generic-ptz-camera/scenarios/safe.json';
import ptzUnsafe from '@/assets/devices/generic-ptz-camera/scenarios/unsafe.json';

import conveyorManifest from '@/assets/devices/generic-conveyor-belt/asset.manifest.json';
import conveyorMeta from '@/assets/devices/generic-conveyor-belt/device.meta.json';
import conveyorGeometry from '@/assets/devices/generic-conveyor-belt/geometry.json';
import conveyorAdapter from '@/assets/devices/generic-conveyor-belt/adapter.manifest.json';
import conveyorSafe from '@/assets/devices/generic-conveyor-belt/scenarios/safe.json';
import conveyorUnsafe from '@/assets/devices/generic-conveyor-belt/scenarios/unsafe.json';

import plcManifest from '@/assets/devices/generic-plc-cabinet/asset.manifest.json';
import plcMeta from '@/assets/devices/generic-plc-cabinet/device.meta.json';
import plcGeometry from '@/assets/devices/generic-plc-cabinet/geometry.json';
import plcAdapter from '@/assets/devices/generic-plc-cabinet/adapter.manifest.json';
import plcSafe from '@/assets/devices/generic-plc-cabinet/scenarios/safe.json';
import plcUnsafe from '@/assets/devices/generic-plc-cabinet/scenarios/unsafe.json';

import lightManifest from '@/assets/devices/generic-smart-light-panel/asset.manifest.json';
import lightMeta from '@/assets/devices/generic-smart-light-panel/device.meta.json';
import lightGeometry from '@/assets/devices/generic-smart-light-panel/geometry.json';
import lightAdapter from '@/assets/devices/generic-smart-light-panel/adapter.manifest.json';
import lightSafe from '@/assets/devices/generic-smart-light-panel/scenarios/safe.json';
import lightUnsafe from '@/assets/devices/generic-smart-light-panel/scenarios/unsafe.json';

import labManifest from '@/assets/devices/generic-lab-instrument/asset.manifest.json';
import labMeta from '@/assets/devices/generic-lab-instrument/device.meta.json';
import labGeometry from '@/assets/devices/generic-lab-instrument/geometry.json';
import labAdapter from '@/assets/devices/generic-lab-instrument/adapter.manifest.json';
import labSafe from '@/assets/devices/generic-lab-instrument/scenarios/safe.json';
import labUnsafe from '@/assets/devices/generic-lab-instrument/scenarios/unsafe.json';

import rackManifest from '@/assets/devices/generic-warehouse-rack/asset.manifest.json';
import rackMeta from '@/assets/devices/generic-warehouse-rack/device.meta.json';
import rackGeometry from '@/assets/devices/generic-warehouse-rack/geometry.json';
import rackAdapter from '@/assets/devices/generic-warehouse-rack/adapter.manifest.json';
import rackSafe from '@/assets/devices/generic-warehouse-rack/scenarios/safe.json';
import rackUnsafe from '@/assets/devices/generic-warehouse-rack/scenarios/unsafe.json';

import sensorManifest from '@/assets/devices/generic-sensor-box/asset.manifest.json';
import sensorMeta from '@/assets/devices/generic-sensor-box/device.meta.json';
import sensorGeometry from '@/assets/devices/generic-sensor-box/geometry.json';
import sensorAdapter from '@/assets/devices/generic-sensor-box/adapter.manifest.json';
import sensorSafe from '@/assets/devices/generic-sensor-box/scenarios/safe.json';
import sensorUnsafe from '@/assets/devices/generic-sensor-box/scenarios/unsafe.json';

function asset(manifest: unknown, deviceMeta: unknown, geometry: unknown, adapterManifest: unknown, safe: unknown, unsafe: unknown): DeviceAsset {
  return { manifest, deviceMeta, geometry, adapterManifest, scenarios: { safe, unsafe } } as DeviceAsset;
}

export class DeviceAssetRegistry {
  private readonly assets = new Map<string, DeviceAsset>();

  register(deviceAsset: DeviceAsset) {
    const validation = validateDeviceAsset(deviceAsset);
    if (!validation.valid) throw new Error(`Invalid device asset ${deviceAsset.manifest.asset_id}: ${validation.failures.join(' ')}`);
    this.assets.set(deviceAsset.manifest.asset_id, deviceAsset);
  }

  get(assetId: string) {
    return this.assets.get(assetId);
  }

  list() {
    return Array.from(this.assets.values());
  }
}

export function createDefaultDeviceAssetRegistry() {
  const registry = new DeviceAssetRegistry();
  [
    asset(robotArmManifest, robotArmMeta, robotArmGeometry, robotArmAdapter, robotArmSafe, robotArmUnsafe),
    asset(agvManifest, agvMeta, agvGeometry, agvAdapter, agvSafe, agvUnsafe),
    asset(ptzManifest, ptzMeta, ptzGeometry, ptzAdapter, ptzSafe, ptzUnsafe),
    asset(conveyorManifest, conveyorMeta, conveyorGeometry, conveyorAdapter, conveyorSafe, conveyorUnsafe),
    asset(plcManifest, plcMeta, plcGeometry, plcAdapter, plcSafe, plcUnsafe),
    asset(lightManifest, lightMeta, lightGeometry, lightAdapter, lightSafe, lightUnsafe),
    asset(labManifest, labMeta, labGeometry, labAdapter, labSafe, labUnsafe),
    asset(rackManifest, rackMeta, rackGeometry, rackAdapter, rackSafe, rackUnsafe),
    asset(sensorManifest, sensorMeta, sensorGeometry, sensorAdapter, sensorSafe, sensorUnsafe)
  ].forEach((item) => registry.register(item));
  return registry;
}

export const builtInDeviceAssets = createDefaultDeviceAssetRegistry().list();
