import type { RuntimeDeviceType, SupportLevel } from '../open-reality-runtime/types';
import { validateRealityAssetPackage } from './assetValidator';
import { BUILTIN_REALITY_ASSETS } from './builtinAssets';
import type { RealityAssetPackage, RealityAssetValidationResult } from './types';

export function getBuiltinRealityAssets(): RealityAssetPackage[] {
  return BUILTIN_REALITY_ASSETS;
}

export function getRealityAssetById(assetId: string): RealityAssetPackage | undefined {
  return BUILTIN_REALITY_ASSETS.find((asset) => asset.assetId === assetId);
}

export function getRealityAssetByDeviceType(deviceType: RuntimeDeviceType): RealityAssetPackage | undefined {
  return BUILTIN_REALITY_ASSETS.find((asset) => asset.deviceType === deviceType);
}

export function listRealityAssetsBySupportLevel(level: SupportLevel): RealityAssetPackage[] {
  return BUILTIN_REALITY_ASSETS.filter((asset) => asset.supportLevel === level);
}

export function validateAllBuiltinAssets(): RealityAssetValidationResult[] {
  return BUILTIN_REALITY_ASSETS.map(validateRealityAssetPackage);
}
