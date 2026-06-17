import type { DeviceAsset } from './DeviceAsset';
import { validateAssetLicense } from './AssetLicenseValidator';
import { DeviceGeometrySchema, DeviceMetaSchema } from '@/lib/schemas/deviceMeta.schema';

export function validateDeviceAsset(asset: DeviceAsset) {
  const failures: string[] = [];
  if (!asset.manifest.asset_id) failures.push('asset_id is required.');
  if (!asset.manifest.display_name) failures.push('display_name is required.');
  if (!asset.manifest.visual_model?.type) failures.push('visual_model.type is required.');
  if (!asset.deviceMeta.profile_id) failures.push('device.meta profile_id is required.');
  if (!asset.geometry.workspace) failures.push('geometry.workspace is required.');
  if (!asset.adapterManifest.adapter_id) failures.push('adapter.manifest adapter_id is required.');
  if (!asset.scenarios.safe || !asset.scenarios.unsafe) failures.push('safe and unsafe scenarios are required.');

  const license = validateAssetLicense(asset.manifest);
  if (!license.valid && license.reason) failures.push(license.reason);
  const meta = DeviceMetaSchema.safeParse(asset.deviceMeta);
  if (!meta.success) failures.push(...meta.error.issues.map((issue) => `device.meta: ${issue.message}`));
  const geometry = DeviceGeometrySchema.safeParse(asset.geometry);
  if (!geometry.success) failures.push(...geometry.error.issues.map((issue) => `geometry: ${issue.message}`));

  return { valid: failures.length === 0, failures };
}
