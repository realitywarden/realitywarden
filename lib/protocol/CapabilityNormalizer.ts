import type { DeviceCapability, DeviceType } from '@/types/deviceMeta';

export type NormalizedCapabilityClass =
  | 'manipulation'
  | 'motion'
  | 'lighting'
  | 'vision'
  | 'sensor'
  | 'automation'
  | 'warehouse'
  | 'lab';

export interface NormalizedCapability {
  raw: DeviceCapability;
  normalized: string;
  capability_class: NormalizedCapabilityClass;
  device_types: DeviceType[];
  requires_target: boolean;
  requires_value: boolean;
  risk_hint: 'low' | 'medium' | 'high';
}

export const CAPABILITY_NORMALIZER: Record<DeviceCapability, NormalizedCapability> = {
  scan_area: {
    raw: 'scan_area',
    normalized: 'vision.scan_area',
    capability_class: 'vision',
    device_types: ['robot_arm', 'camera_sensor'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  identify_object: {
    raw: 'identify_object',
    normalized: 'manipulation.identify_object',
    capability_class: 'manipulation',
    device_types: ['robot_arm'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  move_to_pose: {
    raw: 'move_to_pose',
    normalized: 'motion.move_to_pose',
    capability_class: 'motion',
    device_types: ['robot_arm'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'medium'
  },
  grasp: {
    raw: 'grasp',
    normalized: 'manipulation.grasp',
    capability_class: 'manipulation',
    device_types: ['robot_arm'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'medium'
  },
  release: {
    raw: 'release',
    normalized: 'manipulation.release',
    capability_class: 'manipulation',
    device_types: ['robot_arm'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'medium'
  },
  return_home: {
    raw: 'return_home',
    normalized: 'motion.return_home',
    capability_class: 'motion',
    device_types: ['robot_arm'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  navigate_to: {
    raw: 'navigate_to',
    normalized: 'motion.navigate_to',
    capability_class: 'motion',
    device_types: ['mobile_robot'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'medium'
  },
  dock: {
    raw: 'dock',
    normalized: 'motion.dock',
    capability_class: 'motion',
    device_types: ['mobile_robot'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  set_light: {
    raw: 'set_light',
    normalized: 'lighting.set_power',
    capability_class: 'lighting',
    device_types: ['smart_light'],
    requires_target: false,
    requires_value: true,
    risk_hint: 'low'
  },
  set_brightness: {
    raw: 'set_brightness',
    normalized: 'lighting.set_brightness',
    capability_class: 'lighting',
    device_types: ['smart_light'],
    requires_target: false,
    requires_value: true,
    risk_hint: 'low'
  },
  set_color: {
    raw: 'set_color',
    normalized: 'lighting.set_color',
    capability_class: 'lighting',
    device_types: ['smart_light'],
    requires_target: false,
    requires_value: true,
    risk_hint: 'low'
  },
  capture_frame: {
    raw: 'capture_frame',
    normalized: 'vision.capture_frame',
    capability_class: 'vision',
    device_types: ['camera_sensor'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  read_sensor: {
    raw: 'read_sensor',
    normalized: 'sensor.read_sensor',
    capability_class: 'sensor',
    device_types: ['camera_sensor', 'sensor_box'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  read_register: {
    raw: 'read_register',
    normalized: 'automation.read_register',
    capability_class: 'automation',
    device_types: ['plc_cabinet'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  write_register: {
    raw: 'write_register',
    normalized: 'automation.write_register',
    capability_class: 'automation',
    device_types: ['plc_cabinet'],
    requires_target: true,
    requires_value: true,
    risk_hint: 'medium'
  },
  start_sequence: {
    raw: 'start_sequence',
    normalized: 'automation.start_sequence',
    capability_class: 'automation',
    device_types: ['plc_cabinet'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'medium'
  },
  stop_sequence: {
    raw: 'stop_sequence',
    normalized: 'automation.stop_sequence',
    capability_class: 'automation',
    device_types: ['plc_cabinet'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  read_measurement: {
    raw: 'read_measurement',
    normalized: 'lab.read_measurement',
    capability_class: 'lab',
    device_types: ['lab_instrument'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  set_parameter: {
    raw: 'set_parameter',
    normalized: 'lab.set_parameter',
    capability_class: 'lab',
    device_types: ['lab_instrument'],
    requires_target: true,
    requires_value: true,
    risk_hint: 'medium'
  },
  start_test: {
    raw: 'start_test',
    normalized: 'lab.start_test',
    capability_class: 'lab',
    device_types: ['lab_instrument'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'medium'
  },
  stop_test: {
    raw: 'stop_test',
    normalized: 'lab.stop_test',
    capability_class: 'lab',
    device_types: ['lab_instrument'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  scan_slot: {
    raw: 'scan_slot',
    normalized: 'warehouse.scan_slot',
    capability_class: 'warehouse',
    device_types: ['warehouse_rack'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  reserve_slot: {
    raw: 'reserve_slot',
    normalized: 'warehouse.reserve_slot',
    capability_class: 'warehouse',
    device_types: ['warehouse_rack'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  release_slot: {
    raw: 'release_slot',
    normalized: 'warehouse.release_slot',
    capability_class: 'warehouse',
    device_types: ['warehouse_rack'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'low'
  },
  mark_item: {
    raw: 'mark_item',
    normalized: 'warehouse.mark_item',
    capability_class: 'warehouse',
    device_types: ['warehouse_rack'],
    requires_target: true,
    requires_value: true,
    risk_hint: 'low'
  },
  calibrate_sensor: {
    raw: 'calibrate_sensor',
    normalized: 'sensor.calibrate_sensor',
    capability_class: 'sensor',
    device_types: ['sensor_box'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'medium'
  },
  reset_sensor: {
    raw: 'reset_sensor',
    normalized: 'sensor.reset_sensor',
    capability_class: 'sensor',
    device_types: ['sensor_box'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  start_belt: {
    raw: 'start_belt',
    normalized: 'motion.start_belt',
    capability_class: 'motion',
    device_types: ['conveyor_belt'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'medium'
  },
  stop_belt: {
    raw: 'stop_belt',
    normalized: 'motion.stop_belt',
    capability_class: 'motion',
    device_types: ['conveyor_belt'],
    requires_target: false,
    requires_value: false,
    risk_hint: 'low'
  },
  sort_item: {
    raw: 'sort_item',
    normalized: 'motion.sort_item',
    capability_class: 'motion',
    device_types: ['conveyor_belt'],
    requires_target: true,
    requires_value: false,
    risk_hint: 'medium'
  }
};

export function normalizeCapability(capability: DeviceCapability): NormalizedCapability {
  return CAPABILITY_NORMALIZER[capability];
}

export function normalizeCapabilities(capabilities: DeviceCapability[]): NormalizedCapability[] {
  return capabilities.map(normalizeCapability);
}
