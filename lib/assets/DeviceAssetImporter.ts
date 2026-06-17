import { DeviceGeometrySchema, DeviceMetaSchema } from '@/lib/schemas/deviceMeta.schema';
import type { DeviceAsset, DeviceAssetManifest, AdapterManifest, DeviceAssetScenario } from './DeviceAsset';
import { DeviceAssetRegistry } from './DeviceAssetRegistry';
import { validateDeviceAsset } from './DeviceAssetValidator';

export type ImportableDeviceAssetFile = '.glb' | '.gltf' | '.openreality-device.json';

export interface OpenRealityDeviceFile {
  asset_manifest: DeviceAssetManifest;
  device_meta: unknown;
  geometry: unknown;
  adapter_manifest: AdapterManifest;
  scenarios: DeviceAssetScenario[];
  license: {
    name: string;
    source: string;
  };
}

export interface ImportedDeviceAssetCandidate {
  file_name: string;
  extension: ImportableDeviceAssetFile;
  license?: string;
  manifest?: Partial<DeviceAssetManifest>;
}

export function validateAssetManifest(manifest: Partial<DeviceAssetManifest>) {
  const failures: string[] = [];
  if (!manifest.asset_id) failures.push('asset_id is required.');
  if (!manifest.display_name) failures.push('display_name is required.');
  if (!manifest.category) failures.push('category is required.');
  if (!manifest.device_type) failures.push('device_type is required.');
  if (!manifest.license) failures.push('license is required.');
  if (!manifest.brand) failures.push('brand is required.');
  if (!['generic', 'user-owned', 'vendor-authorized'].includes(String(manifest.brand))) {
    failures.push('brand must be generic, user-owned, or vendor-authorized.');
  }
  if (!manifest.source) failures.push('source is required.');
  if (!manifest.visual_model?.type) failures.push('visual_model.type is required.');
  return { valid: failures.length === 0, failures };
}

export function validateLicense(manifest: Partial<DeviceAssetManifest>) {
  if (!manifest.license || manifest.license.trim().length === 0) {
    return { valid: false, failures: ['license is required.'] };
  }
  if (!manifest.source || manifest.source.trim().length === 0) {
    return { valid: false, failures: ['source is required.'] };
  }
  if (manifest.brand && !['generic', 'user-owned', 'vendor-authorized'].includes(String(manifest.brand))) {
    return { valid: false, failures: ['brand must be generic, user-owned, or vendor-authorized.'] };
  }
  return { valid: true, failures: [] };
}

export function validateDeviceMeta(deviceMeta: unknown) {
  const parsed = DeviceMetaSchema.safeParse(deviceMeta);
  return parsed.success ? { valid: true, failures: [], value: parsed.data } : { valid: false, failures: parsed.error.issues.map((issue) => issue.message) };
}

export function validateGeometry(geometry: unknown) {
  const parsed = DeviceGeometrySchema.safeParse(geometry);
  return parsed.success ? { valid: true, failures: [], value: parsed.data } : { valid: false, failures: parsed.error.issues.map((issue) => issue.message) };
}

export function validateAdapterManifest(adapterManifest: Partial<AdapterManifest>) {
  const failures: string[] = [];
  if (!adapterManifest.adapter_id) failures.push('adapter_id is required.');
  if (!adapterManifest.adapter_type) failures.push('adapter_type is required.');
  if (!adapterManifest.interface) failures.push('interface is required.');
  if (!Array.isArray(adapterManifest.supported_commands) || adapterManifest.supported_commands.length === 0) failures.push('supported_commands are required.');
  return { valid: failures.length === 0, failures };
}

export function createImportedAsset(file: OpenRealityDeviceFile): DeviceAsset {
  const manifestCheck = validateAssetManifest(file.asset_manifest);
  const licenseCheck = validateLicense(file.asset_manifest);
  const metaCheck = validateDeviceMeta(file.device_meta);
  const geometryCheck = validateGeometry(file.geometry);
  const adapterCheck = validateAdapterManifest(file.adapter_manifest);
  const failures = [
    ...manifestCheck.failures,
    ...licenseCheck.failures,
    ...metaCheck.failures,
    ...geometryCheck.failures,
    ...adapterCheck.failures
  ];
  if (failures.length > 0) throw new Error(`Cannot import device asset: ${failures.join(' ')}`);

  const safe = file.scenarios.find((scenario) => scenario.expected_safety_result === 'pass');
  const unsafe = file.scenarios.find((scenario) => scenario.expected_safety_result === 'blocked');
  if (!safe || !unsafe) throw new Error('Imported asset requires at least one safe and one unsafe scenario.');

  const asset = {
    manifest: file.asset_manifest,
    deviceMeta: metaCheck.value,
    geometry: geometryCheck.value,
    adapterManifest: file.adapter_manifest,
    scenarios: { safe, unsafe }
  } as DeviceAsset;
  const validation = validateDeviceAsset(asset);
  if (!validation.valid) throw new Error(`Cannot import device asset: ${validation.failures.join(' ')}`);
  return asset;
}

export function registerImportedAsset(registry: DeviceAssetRegistry, asset: DeviceAsset) {
  registry.register(asset);
  return registry.get(asset.manifest.asset_id);
}

export function validateImportedDeviceAsset(candidate: ImportedDeviceAssetCandidate) {
  if (!['.glb', '.gltf', '.openreality-device.json'].includes(candidate.extension)) {
    return { valid: false, reason: 'Unsupported device asset file type.' };
  }
  const license = validateLicense({ ...candidate.manifest, license: candidate.license ?? candidate.manifest?.license });
  if (!license.valid) return { valid: false, reason: license.failures.join(' ') };
  return { valid: true, reason: null };
}
