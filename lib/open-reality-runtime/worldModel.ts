import type { DeviceProfile } from '../../types/deviceMeta';
import type { RuntimeDeviceType, WorldModel, WorldObject, WorldZone } from './types';

export function createDefaultWorldModel(targetDeviceId = 'virtual_robot_arm'): WorldModel {
  return {
    objects: [
      { id: 'red_cube', type: 'cube', color: 'red', zone: 'pickup_zone', pose: [-0.55, 0.12, 0.05], movable: true },
      { id: 'blue_cube', type: 'cube', color: 'blue', zone: 'inspection_zone', pose: [0.35, 0.12, -0.12], movable: true }
    ],
    zones: [
      { id: 'pickup_zone', label: 'Pickup Zone', safe: true },
      { id: 'back_safe_zone', label: 'Back Safe Zone', safe: true },
      { id: 'table_workspace', label: 'Table Workspace', safe: true },
      { id: 'forbidden_outside_table', label: 'Outside Table', safe: false },
      { id: 'outside_table', label: 'Outside Table', safe: false },
      { id: 'left_safe_zone', label: 'Left Safe Zone', safe: true },
      { id: 'right_safe_zone', label: 'Right Safe Zone', safe: true },
      { id: 'front_safe_zone', label: 'Front Safe Zone', safe: true },
      { id: 'inspection_zone', label: 'Inspection Zone', safe: true },
      { id: 'zone_a', label: 'Zone A', safe: true },
      { id: 'current_area', label: 'Current Area', safe: true }
    ],
    devices: [
      { deviceId: targetDeviceId, status: 'selected', selected: true, supportLevel: 'simulation_only' }
    ],
    confidence: 'high'
  };
}

export function buildWorldModelFromProfile(
  profile: DeviceProfile,
  options?: {
    targetDeviceId?: string;
    selected?: boolean;
    status?: 'idle' | 'selected' | 'executing' | 'blocked' | 'completed';
  }
): WorldModel {
  const geometry = profile.geometry;
  const targetDeviceId = options?.targetDeviceId ?? profile.deviceMeta.device_id;
  const supportLevel = profile.deviceMeta.device_type === 'camera_sensor'
    ? 'read_only'
    : profile.deviceMeta.device_type === 'robot_arm' || profile.deviceMeta.device_type === 'smart_light'
      ? 'simulation_only'
      : 'coming_soon';

  const objects: WorldObject[] = [];
  if (geometry.objects?.red_cube) {
    objects.push({
      id: 'red_cube',
      type: 'cube',
      color: 'red',
      zone: 'pickup_zone',
      pose: geometry.objects.red_cube.position,
      movable: true
    });
  }
  if (geometry.objects?.blue_cube) {
    objects.push({
      id: 'blue_cube',
      type: 'cube',
      color: 'blue',
      zone: 'inspection_zone',
      pose: geometry.objects.blue_cube.position,
      movable: true
    });
  }
  if (geometry.objects?.glass_cup) {
    objects.push({
      id: 'glass_cup',
      type: 'fragile_object',
      zone: 'glass_cup_neighborhood',
      pose: geometry.objects.glass_cup.position,
      movable: false
    });
  }

  const zones: WorldZone[] = Object.entries(geometry.zones ?? {}).map(([id]) => ({
    id,
    label: id,
    safe: !id.includes('outside') && !id.includes('forbidden') && !id.includes('restricted')
  }));
  if (!zones.some((zone) => zone.id === 'table_workspace')) {
    zones.push({ id: 'table_workspace', label: 'Table Workspace', safe: true });
  }
  if (!zones.some((zone) => zone.id === 'forbidden_outside_table')) {
    zones.push({ id: 'forbidden_outside_table', label: 'Outside Table', safe: false });
  }
  if (!zones.some((zone) => zone.id === 'outside_table')) {
    zones.push({ id: 'outside_table', label: 'Outside Table', safe: false });
  }
  if (!zones.some((zone) => zone.id === 'zone_a')) {
    zones.push({ id: 'zone_a', label: 'Zone A', safe: true });
  }
  if (!zones.some((zone) => zone.id === 'current_area')) {
    zones.push({ id: 'current_area', label: 'Current Area', safe: true });
  }

  return {
    objects,
    zones,
    devices: [
      {
        deviceId: targetDeviceId,
        status: options?.status ?? (options?.selected ? 'selected' : 'idle'),
        selected: Boolean(options?.selected),
        supportLevel
      }
    ],
    confidence: 'high'
  };
}

export function findWorldObject(worldModel: WorldModel, objectRef?: string): WorldObject | null {
  if (!objectRef) return null;
  if (objectRef === 'cube') {
    const cubes = worldModel.objects.filter((object) => object.type === 'cube');
    return cubes.length === 1 ? cubes[0] : null;
  }
  return worldModel.objects.find((object) => object.id === objectRef) ?? null;
}

export function findWorldZone(worldModel: WorldModel, targetZone?: string): WorldZone | null {
  if (!targetZone) return null;
  return worldModel.zones.find((zone) => zone.id === targetZone) ?? null;
}

export function isRuntimeDeviceType(value: string): value is RuntimeDeviceType {
  return [
    'robot_arm',
    'mobile_robot',
    'smart_light',
    'camera_sensor',
    'conveyor_belt',
    'plc_cabinet',
    'lab_instrument',
    'warehouse_rack',
    'sensor_box',
    'drone_unit',
    'unknown_device'
  ].includes(value);
}
