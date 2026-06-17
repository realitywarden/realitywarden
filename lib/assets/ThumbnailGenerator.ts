import type { DeviceAsset } from './DeviceAsset';

export type RuntimeThumbnailMode = 'thumbnail' | 'mini_3d_preview' | 'procedural_preview';

export function getRuntimeThumbnailMode(asset: DeviceAsset): RuntimeThumbnailMode {
  const visual = asset.manifest.visual_model;
  if (visual.path && visual.type === 'glb') return 'mini_3d_preview';
  if (visual.path && visual.type === 'gltf') return 'mini_3d_preview';
  return 'procedural_preview';
}
