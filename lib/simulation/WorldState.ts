import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { WorldState } from '@/types/simulation';
import { createObjectRegistry } from './ObjectRegistry';

export function createInitialWorldState(deviceMeta: DeviceMeta, geometry: DeviceGeometry): WorldState {
  const home: [number, number, number] = [
    geometry.robot.base_position[0],
    geometry.robot.base_position[1] + geometry.robot.arm_segments[0],
    geometry.robot.base_position[2]
  ];

  const objects = createObjectRegistry(geometry);
  const forbidden_zones = Object.values(objects).filter((object) => object.kind === 'forbidden_zone');

  return {
    profile_id: deviceMeta.profile_id,
    robot: {
      base_position: geometry.robot.base_position,
      current_position: home,
      home_position: home,
      arm_segments: geometry.robot.arm_segments
    },
    objects,
    gripper: {
      status: 'open'
    },
    workspace: geometry.workspace,
    forbidden_zones,
    execution_status: 'idle'
  };
}

export function cloneWorldState(world: WorldState): WorldState {
  return JSON.parse(JSON.stringify(world)) as WorldState;
}
