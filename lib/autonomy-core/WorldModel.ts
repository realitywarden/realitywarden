export type Vector3 = [number, number, number];

export interface WorldObject {
  id: string;
  type: 'cube' | 'fragile_object';
  color?: 'red' | 'blue';
  position: Vector3;
  movable: boolean;
  fragile?: boolean;
}

export interface SpatialRegion {
  id: string;
  position: Vector3;
  size?: [number, number];
  outside_workspace?: boolean;
  near_fragile_object?: boolean;
}

export interface WorldModel {
  objects: WorldObject[];
  spatial_regions: Record<string, SpatialRegion>;
  device_state: {
    device_id: string;
    end_effector_position: Vector3;
    holding_object: string | null;
  };
  workspace_bounds: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
    z_min: number;
    z_max: number;
  };
}

export interface GroundingResult {
  object_id?: string;
  target_region_id?: string;
  errors: Array<'ambiguous_object' | 'unknown_object' | 'unknown_target'>;
}
