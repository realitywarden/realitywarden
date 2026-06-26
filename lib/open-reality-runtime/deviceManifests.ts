import type { DeviceProfile } from '../../types/deviceMeta';
import { getCapabilityContracts } from './capabilityContract';
import type { DeviceManifest, RuntimeDeviceType, SupportLevel } from './types';

function manifest(
  deviceId: string,
  displayName: string,
  category: DeviceManifest['category'],
  supportLevel: SupportLevel,
  capabilityIds: string[],
  blockedGoals: DeviceManifest['riskProfile']['blockedGoals'] = []
): DeviceManifest {
  return {
    deviceId,
    displayName,
    category,
    supportLevel,
    capabilities: getCapabilityContracts(capabilityIds),
    workspace: {
      allowedZones: ['pickup_zone', 'inspection_zone', 'left_safe_zone', 'right_safe_zone', 'front_safe_zone', 'back_safe_zone', 'table_workspace', 'zone_a', 'current_area'],
      forbiddenZones: ['forbidden_outside_table', 'outside_table', 'restricted_zone', 'privacy_zone']
    },
    constraints: {
      maxSpeed: 'normal',
      maxForce: 'medium',
      precisionLevel: 'medium',
      requiresCollisionCheck: category === 'manipulator' || category === 'mobile_robot',
      requiresSimulation: supportLevel !== 'unsupported',
      requiresHumanApproval: false
    },
    riskProfile: {
      baseRisk: supportLevel === 'read_only' ? 'low' : 'medium',
      hazardousCapabilities: ['emergency_stop'],
      blockedGoals
    },
    adapter: {
      simulationAdapter: `${deviceId}.simulation`,
      realAdapterEnabled: false
    }
  };
}

export const OPEN_REALITY_DEVICE_MANIFESTS: Record<RuntimeDeviceType, DeviceManifest> = {
  robot_arm: manifest(
    'virtual_robot_arm',
    'Generic Industrial Robot Arm',
    'manipulator',
    'simulation_only',
    ['observe', 'detect_object', 'locate_object', 'move_to_pose', 'pick', 'place', 'grasp', 'release', 'return_home', 'stop', 'collision_check', 'workspace_check', 'simulation_check'],
    ['throw_object', 'smash_object', 'move_outside_workspace', 'destructive_action', 'unsafe_speed']
  ),
  smart_light: manifest(
    'virtual_smart_light',
    'Generic Smart Light Panel',
    'smart_light',
    'simulation_only',
    ['turn_on', 'turn_off', 'set_color', 'set_brightness', 'read_sensor']
  ),
  camera_sensor: manifest(
    'virtual_camera_sensor',
    'Camera Sensor',
    'camera',
    'read_only',
    ['capture_image', 'scan', 'read_sensor', 'observe', 'inspect']
  ),
  mobile_robot: manifest(
    'virtual_mobile_robot',
    'Generic AGV Mobile Robot',
    'mobile_robot',
    'coming_soon',
    ['move', 'return_home', 'stop', 'emergency_stop']
  ),
  conveyor_belt: manifest(
    'virtual_conveyor_belt',
    'Generic Conveyor Belt',
    'conveyor',
    'coming_soon',
    ['convey', 'set_speed', 'stop', 'emergency_stop']
  ),
  plc_cabinet: manifest(
    'virtual_plc_cabinet',
    'Generic PLC Cabinet',
    'plc',
    'coming_soon',
    ['read_sensor', 'set_value', 'stop', 'emergency_stop']
  ),
  lab_instrument: manifest(
    'virtual_lab_instrument',
    'Generic Lab Instrument',
    'lab_instrument',
    'coming_soon',
    ['measure', 'dispense', 'heat', 'cool', 'inspect', 'test', 'record']
  ),
  warehouse_rack: manifest(
    'virtual_warehouse_rack',
    'Generic Warehouse Rack',
    'warehouse_system',
    'coming_soon',
    ['locate_object', 'sort', 'route']
  ),
  sensor_box: manifest(
    'virtual_sensor_box',
    'Generic Sensor Box',
    'sensor',
    'coming_soon',
    ['read_sensor', 'record', 'observe']
  ),
  drone_unit: manifest(
    'virtual_drone_unit',
    'Generic Drone Unit',
    'drone',
    'coming_soon',
    ['move', 'capture_image', 'return_home', 'stop', 'emergency_stop']
  ),
  unknown_device: manifest(
    'unknown_device',
    'Unknown Device',
    'generic_device',
    'unsupported',
    []
  )
};

export function getOpenRealityDeviceManifest(deviceType: RuntimeDeviceType): DeviceManifest {
  return OPEN_REALITY_DEVICE_MANIFESTS[deviceType] ?? OPEN_REALITY_DEVICE_MANIFESTS.unknown_device;
}

export function buildManifestFromProfile(profile: DeviceProfile): DeviceManifest {
  const supportLevelMap: Partial<Record<DeviceProfile['deviceMeta']['device_type'], SupportLevel>> = {
    robot_arm: 'simulation_only',
    smart_light: 'simulation_only',
    camera_sensor: 'read_only',
    mobile_robot: 'coming_soon',
    conveyor_belt: 'coming_soon',
    plc_cabinet: 'coming_soon',
    lab_instrument: 'coming_soon',
    warehouse_rack: 'coming_soon',
    sensor_box: 'coming_soon'
  };
  const categoryMap: Record<DeviceProfile['deviceMeta']['device_type'], DeviceManifest['category']> = {
    robot_arm: 'manipulator',
    mobile_robot: 'mobile_robot',
    smart_light: 'smart_light',
    camera_sensor: 'camera',
    conveyor_belt: 'conveyor',
    plc_cabinet: 'plc',
    lab_instrument: 'lab_instrument',
    warehouse_rack: 'warehouse_system',
    sensor_box: 'sensor'
  };

  const supportLevel = supportLevelMap[profile.deviceMeta.device_type] ?? 'unsupported';
  const manifestFromType = getOpenRealityDeviceManifest(profile.deviceMeta.device_type as RuntimeDeviceType);

  return {
    ...manifestFromType,
    deviceId: profile.deviceMeta.device_id,
    displayName: profile.deviceMeta.display_name,
    category: categoryMap[profile.deviceMeta.device_type],
    workspace: {
      allowedZones: profile.deviceMeta.constraints.known_targets ?? manifestFromType.workspace.allowedZones,
      forbiddenZones: profile.deviceMeta.constraints.forbidden_zones
    },
    constraints: {
      maxSpeed: profile.deviceMeta.constraints.max_speed,
      maxForce: profile.deviceMeta.constraints.force_limit,
      precisionLevel: profile.deviceMeta.risk_class === 'high' ? 'high' : profile.deviceMeta.risk_class === 'medium' ? 'medium' : 'low',
      requiresCollisionCheck: profile.deviceMeta.constraints.forbidden_zones.length > 0,
      requiresSimulation: true,
      requiresHumanApproval: profile.deviceMeta.safety_profile.require_human_confirmation_for_risky_actions
    },
    supportLevel
  };
}
