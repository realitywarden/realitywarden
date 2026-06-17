import { z } from 'zod';

export const DeviceCapabilitySchema = z.enum([
  'scan_area',
  'identify_object',
  'move_to_pose',
  'grasp',
  'release',
  'return_home',
  'navigate_to',
  'dock',
  'set_light',
  'set_brightness',
  'set_color',
  'capture_frame',
  'read_sensor',
  'read_register',
  'write_register',
  'start_sequence',
  'stop_sequence',
  'read_measurement',
  'set_parameter',
  'start_test',
  'stop_test',
  'scan_slot',
  'reserve_slot',
  'release_slot',
  'mark_item',
  'calibrate_sensor',
  'reset_sensor',
  'start_belt',
  'stop_belt',
  'sort_item'
]);

export const DeviceTypeSchema = z.enum(['robot_arm', 'mobile_robot', 'smart_light', 'camera_sensor', 'conveyor_belt', 'plc_cabinet', 'lab_instrument', 'warehouse_rack', 'sensor_box']);

export const SimulatorProfileSchema = z.enum([
  'robot_arm_semantic_v1',
  'mobile_robot_semantic_v1',
  'smart_light_semantic_v1',
  'camera_sensor_semantic_v1',
  'conveyor_belt_semantic_v1',
  'plc_cabinet_semantic_v1',
  'lab_instrument_semantic_v1',
  'warehouse_rack_semantic_v1',
  'sensor_box_semantic_v1'
]);

export const DeviceMetaSchema = z.object({
  profile_id: z.string().min(1),
  profile_version: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  device_id: z.string().min(1),
  device_type: DeviceTypeSchema,
  simulator_profile: SimulatorProfileSchema,
  simulator_fidelity: z.object({
    level: z.enum(['semantic', 'kinematic', 'physics']),
    validates: z.array(z.string()).min(1),
    limitations: z.array(z.string())
  }).optional(),
  supported_adapters: z.array(z.string()).min(1),
  risk_class: z.enum(['low', 'medium', 'high']),
  display_name: z.string().min(1),
  model_asset: z.object({
    format: z.enum(['glb', 'gltf']),
    uri: z.string().min(1),
    source: z.enum(['real_device_cad', 'open_source_robot_model', 'generated_placeholder']),
    license: z.string().optional(),
    attribution: z.string().optional(),
    scale: z.number().positive().optional(),
    rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
    position: z.tuple([z.number(), z.number(), z.number()]).optional()
  }).optional(),
  capabilities: z.array(DeviceCapabilitySchema).min(1),
  constraints: z.object({
    workspace: z.object({
      x_min: z.number(),
      x_max: z.number(),
      y_min: z.number(),
      y_max: z.number(),
      z_min: z.number(),
      z_max: z.number()
    }),
    max_speed: z.enum(['slow', 'normal', 'fast']),
    force_limit: z.enum(['low', 'medium', 'high']),
    forbidden_zones: z.array(z.string()),
    known_targets: z.array(z.string()).optional()
  }),
  safety_profile: z.object({
    allow_throwing: z.boolean(),
    allow_high_force: z.boolean(),
    allow_outside_workspace: z.boolean(),
    medium_risk_requires_confirmation: z.boolean().optional(),
    block_medium_risk: z.boolean().optional(),
    require_logging: z.boolean(),
    require_human_confirmation_for_risky_actions: z.boolean()
  }),
  runtime_state: z.object({
    status: z.enum(['idle', 'executing', 'blocked', 'completed']),
    current_position: z.string()
  })
});

const Vector3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const DeviceGeometrySchema = z.object({
  table: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive()
  }),
  robot: z.object({
    base_position: Vector3Schema,
    arm_segments: z.tuple([z.number().positive(), z.number().positive()]),
    gripper_size: z.number().positive()
  }),
  objects: z.object({
    red_cube: z.object({ position: Vector3Schema, size: z.number().positive() }),
    blue_cube: z.object({ position: Vector3Schema, size: z.number().positive() }),
    glass_cup: z.object({ position: Vector3Schema, radius: z.number().positive(), height: z.number().positive() })
  }),
  zones: z.record(z.object({
    position: Vector3Schema,
    size: z.tuple([z.number().positive(), z.number().positive()])
  })),
  workspace: z.object({
    x_min: z.number(),
    x_max: z.number(),
    y_min: z.number(),
    y_max: z.number(),
    z_min: z.number(),
    z_max: z.number()
  }),
  camera: z.object({
    position: Vector3Schema,
    target: Vector3Schema
  }),
  stage: z.object({
    layout: z.string(),
    nodes: z.record(z.object({ position: Vector3Schema, label: z.string().optional() })).optional(),
    indicators: z.record(z.string()).optional()
  }).optional()
});
