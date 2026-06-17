import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { SpatialRegion, WorldModel } from './WorldModel';

function region(id: string, position: [number, number, number], extra: Partial<SpatialRegion> = {}): SpatialRegion {
  return { id, position, ...extra };
}

export class WorldModelBuilder {
  fromRobotArm(deviceMeta: DeviceMeta, geometry: DeviceGeometry, deviceState: Record<string, unknown> = {}): WorldModel {
    return {
      objects: [
        { id: 'red_cube', type: 'cube', color: 'red', position: geometry.objects.red_cube.position, movable: true },
        { id: 'blue_cube', type: 'cube', color: 'blue', position: geometry.objects.blue_cube.position, movable: true },
        { id: 'glass_cup', type: 'fragile_object', position: geometry.objects.glass_cup.position, movable: false, fragile: true }
      ],
      spatial_regions: {
        front_area: region('front_area', geometry.zones.front_safe_zone?.position ?? [0, 0.13, 0.75]),
        back_area: region('back_area', geometry.zones.back_safe_zone?.position ?? [0, 0.13, -0.75]),
        left_area: region('left_area', geometry.zones.left_safe_zone?.position ?? [-0.95, 0.13, -0.3]),
        right_area: region('right_area', geometry.zones.right_safe_zone?.position ?? [0.95, 0.13, 0.2]),
        table_area: region('table_area', [0, geometry.table.height, 0]),
        outside_table: region('outside_table', [geometry.workspace.x_max + 0.5, 0, 0], { outside_workspace: true }),
        glass_cup_neighborhood: region('glass_cup_neighborhood', geometry.objects.glass_cup.position, { near_fragile_object: true })
      },
      device_state: {
        device_id: deviceMeta.device_id,
        end_effector_position: (deviceState.gripper_position as [number, number, number]) ?? [0.82, 1.38, 0],
        holding_object: (deviceState.holding_object as string | null) ?? null
      },
      workspace_bounds: geometry.workspace
    };
  }
}
