export type DeviceCapability =
  | 'scan_area'
  | 'identify_object'
  | 'move_to_pose'
  | 'grasp'
  | 'release'
  | 'return_home'
  | 'navigate_to'
  | 'dock'
  | 'set_light'
  | 'set_brightness'
  | 'set_color'
  | 'capture_frame'
  | 'read_sensor'
  | 'read_register'
  | 'write_register'
  | 'start_sequence'
  | 'stop_sequence'
  | 'read_measurement'
  | 'set_parameter'
  | 'start_test'
  | 'stop_test'
  | 'scan_slot'
  | 'reserve_slot'
  | 'release_slot'
  | 'mark_item'
  | 'calibrate_sensor'
  | 'reset_sensor'
  | 'start_belt'
  | 'stop_belt'
  | 'sort_item';

export type DeviceType =
  | 'robot_arm'
  | 'mobile_robot'
  | 'smart_light'
  | 'camera_sensor'
  | 'conveyor_belt'
  | 'plc_cabinet'
  | 'lab_instrument'
  | 'warehouse_rack'
  | 'sensor_box';

export type SimulatorProfile =
  | 'robot_arm_semantic_v1'
  | 'mobile_robot_semantic_v1'
  | 'smart_light_semantic_v1'
  | 'camera_sensor_semantic_v1'
  | 'conveyor_belt_semantic_v1'
  | 'plc_cabinet_semantic_v1'
  | 'lab_instrument_semantic_v1'
  | 'warehouse_rack_semantic_v1'
  | 'sensor_box_semantic_v1';

export interface DeviceMeta {
  profile_id: string;
  profile_version: string;
  manufacturer: string;
  model: string;
  device_id: string;
  device_type: DeviceType;
  simulator_profile: SimulatorProfile;
  simulator_fidelity?: {
    level: 'semantic' | 'kinematic' | 'physics';
    validates: string[];
    limitations: string[];
  };
  supported_adapters: string[];
  risk_class: 'low' | 'medium' | 'high';
  display_name: string;
  model_asset?: {
    format: 'glb' | 'gltf';
    uri: string;
    source: 'real_device_cad' | 'open_source_robot_model' | 'generated_placeholder';
    license?: string;
    attribution?: string;
    scale?: number;
    rotation?: [number, number, number];
    position?: [number, number, number];
  };
  capabilities: DeviceCapability[];
  constraints: {
    workspace: {
      x_min: number;
      x_max: number;
      y_min: number;
      y_max: number;
      z_min: number;
      z_max: number;
    };
    max_speed: 'slow' | 'normal' | 'fast';
    force_limit: 'low' | 'medium' | 'high';
    forbidden_zones: string[];
    known_targets?: string[];
  };
  safety_profile: {
    allow_throwing: boolean;
    allow_high_force: boolean;
    allow_outside_workspace: boolean;
    medium_risk_requires_confirmation?: boolean;
    block_medium_risk?: boolean;
    require_logging: boolean;
    require_human_confirmation_for_risky_actions: boolean;
  };
  runtime_state: {
    status: 'idle' | 'executing' | 'blocked' | 'completed';
    current_position: string;
  };
}

export interface DeviceGeometry {
  table: {
    width: number;
    depth: number;
    height: number;
  };
  robot: {
    base_position: [number, number, number];
    arm_segments: [number, number];
    gripper_size: number;
  };
  objects: {
    red_cube: { position: [number, number, number]; size: number };
    blue_cube: { position: [number, number, number]; size: number };
    glass_cup: { position: [number, number, number]; radius: number; height: number };
  };
  zones: Record<string, { position: [number, number, number]; size: [number, number] }>;
  workspace: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
    z_min: number;
    z_max: number;
  };
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  stage?: {
    layout: string;
    nodes?: Record<string, { position: [number, number, number]; label?: string }>;
    indicators?: Record<string, string>;
  };
}

export interface DeviceProfile {
  id: string;
  label: string;
  deviceMeta: DeviceMeta;
  geometry: DeviceGeometry;
}
