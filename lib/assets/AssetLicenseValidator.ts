import type { DeviceAssetManifest } from './DeviceAsset';

export function validateAssetLicense(manifest: DeviceAssetManifest) {
  if (!manifest.license || manifest.license.trim().length === 0) {
    return { valid: false, reason: 'Device asset license is required.' };
  }
  if (!['generic', 'user-owned', 'vendor-authorized'].includes(manifest.brand)) {
    return { valid: false, reason: 'Device asset brand must be generic, user-owned, or vendor-authorized.' };
  }
  if (manifest.brand !== 'generic' && manifest.source === 'created-for-open-reality-studio') {
    return { valid: false, reason: 'Built-in Open Reality assets must use generic brand.' };
  }
  return { valid: true, reason: null };
}
