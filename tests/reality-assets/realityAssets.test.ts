import { strict as assert } from 'node:assert';
import {
  getBuiltinRealityAssets,
  getRealityAssetByDeviceType,
  listRealityAssetsBySupportLevel,
  validateAllBuiltinAssets,
  validateRealityAssetPackage
} from '../../lib/reality-assets';
import type { RealityAssetPackage } from '../../lib/reality-assets';

const assets = getBuiltinRealityAssets();
const byType = (deviceType: RealityAssetPackage['deviceType']) => {
  const asset = getRealityAssetByDeviceType(deviceType);
  assert(asset, `${deviceType} asset must exist.`);
  return asset;
};

assert.equal(assets.length, 8, 'Registry must expose the eight v0.2 Sprint 1 built-in Reality Assets.');

for (const deviceType of [
  'robot_arm',
  'smart_light',
  'camera_sensor',
  'mobile_robot',
  'conveyor_belt',
  'plc_cabinet',
  'lab_instrument',
  'drone_unit'
] as const) {
  const asset = byType(deviceType);
  const result = validateRealityAssetPackage(asset);
  assert.equal(result.valid, true, `${deviceType} must validate: ${result.errors.join(', ')}`);
  assert(asset.deviceManifest, `${deviceType} must include DeviceManifest.`);
  assert(asset.capabilityContracts.length > 0, `${deviceType} must include CapabilityContract entries.`);
  assert(asset.adapterBoundary, `${deviceType} must include adapterBoundary.`);
  assert(Object.values(asset.examplePrompts).some((prompts) => prompts.length > 0), `${deviceType} must include example prompts.`);
  assert.equal(asset.adapterBoundary.realAdapterEnabled, false, `${deviceType} realAdapterEnabled must be false.`);
  assert.equal(asset.deviceManifest.adapter.realAdapterEnabled, false, `${deviceType} manifest realAdapterEnabled must be false.`);
}

assert.equal(byType('robot_arm').supportLevel, 'simulation_only', 'robot_arm must be simulation_only.');
assert.equal(byType('smart_light').supportLevel, 'simulation_only', 'smart_light must be simulation_only.');
assert.equal(byType('camera_sensor').supportLevel, 'read_only', 'camera_sensor must be read_only.');

for (const deviceType of ['mobile_robot', 'conveyor_belt', 'plc_cabinet', 'lab_instrument', 'drone_unit'] as const) {
  const asset = byType(deviceType);
  assert.equal(asset.supportLevel, 'coming_soon', `${deviceType} must remain coming_soon.`);
  assert.equal(asset.adapterBoundary.simulationAdapterAvailable, false, `${deviceType} must not be runnable.`);
}

assert.equal(listRealityAssetsBySupportLevel('simulation_only').length, 2, 'Two assets should be simulation_only.');
assert.equal(listRealityAssetsBySupportLevel('read_only').length, 1, 'One asset should be read_only.');
assert.equal(listRealityAssetsBySupportLevel('coming_soon').length, 5, 'Five assets should be coming_soon.');

const invalidWithoutManifest = {
  ...byType('robot_arm'),
  deviceManifest: undefined
} as unknown as RealityAssetPackage;
assert.equal(validateRealityAssetPackage(invalidWithoutManifest).valid, false, 'Asset without manifest must fail validation.');

const invalidRealAdapter = {
  ...byType('smart_light'),
  adapterBoundary: {
    ...byType('smart_light').adapterBoundary,
    realAdapterEnabled: true
  }
} as unknown as RealityAssetPackage;
assert.equal(validateRealityAssetPackage(invalidRealAdapter).valid, false, 'Asset with realAdapterEnabled true must fail validation.');

const invalidComingSoonRunnable = {
  ...byType('mobile_robot'),
  adapterBoundary: {
    ...byType('mobile_robot').adapterBoundary,
    simulationAdapterAvailable: true
  }
};
assert.equal(validateRealityAssetPackage(invalidComingSoonRunnable).valid, false, 'Coming Soon runnable asset must fail validation.');

const allResults = validateAllBuiltinAssets();
assert.equal(allResults.every((result) => result.valid), true, 'All built-in Reality Assets must validate.');

console.log('Reality Asset ecosystem tests passed.');
