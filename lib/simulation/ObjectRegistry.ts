import type { DeviceGeometry } from '@/types/deviceMeta';
import type { SimObject } from '@/types/simulation';

export function createObjectRegistry(geometry: DeviceGeometry): Record<string, SimObject> {
  const registry: Record<string, SimObject> = {
    red_cube: {
      id: 'red_cube',
      kind: 'cube',
      position: geometry.objects.red_cube.position,
      size: geometry.objects.red_cube.size
    },
    blue_cube: {
      id: 'blue_cube',
      kind: 'cube',
      position: geometry.objects.blue_cube.position,
      size: geometry.objects.blue_cube.size
    },
    glass_cup: {
      id: 'glass_cup',
      kind: 'obstacle',
      position: geometry.objects.glass_cup.position,
      radius: geometry.objects.glass_cup.radius,
      height: geometry.objects.glass_cup.height
    }
  };

  for (const [zoneId, zone] of Object.entries(geometry.zones)) {
    registry[zoneId] = {
      id: zoneId,
      kind: zoneId.includes('safe') ? 'safe_zone' : 'forbidden_zone',
      position: zone.position,
      zone_size: zone.size
    };
  }

  registry.home = {
    id: 'home',
    kind: 'robot_target',
    position: [
      geometry.robot.base_position[0],
      geometry.robot.base_position[1] + geometry.robot.arm_segments[0],
      geometry.robot.base_position[2]
    ]
  };

  return registry;
}
