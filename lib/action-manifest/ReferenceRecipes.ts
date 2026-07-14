import robotArmRecipe from '../../examples/action-manifests/scan_left_to_right.json';
import smartLightRecipe from '../../examples/action-manifests/focus_work_light.json';
import cameraRecipe from '../../examples/action-manifests/inspect_then_capture.json';
import type { DeviceType } from '@/types/deviceMeta';

const recipes: Partial<Record<DeviceType, unknown>> = {
  robot_arm: robotArmRecipe,
  smart_light: smartLightRecipe,
  camera_sensor: cameraRecipe
};

/**
 * Returns a defensive raw proposal. The caller MUST pass it through
 * validateActionManifest for the currently selected profile before use.
 */
export function getReferenceActionRecipe(deviceType: DeviceType): unknown | null {
  const recipe = recipes[deviceType];
  return recipe === undefined ? null : JSON.parse(JSON.stringify(recipe)) as unknown;
}
