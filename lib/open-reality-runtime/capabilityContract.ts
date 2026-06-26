import type { CapabilityContract } from './types';

function capability(
  id: string,
  category: CapabilityContract['category'],
  riskLevel: CapabilityContract['riskLevel'],
  executionPermission: CapabilityContract['executionPermission'],
  description: string,
  requiredInputs: string[] = [],
  optionalInputs: string[] = [],
  outputs: string[] = []
): CapabilityContract {
  return {
    id,
    name: id,
    category,
    description,
    requiredInputs,
    optionalInputs,
    outputs,
    preconditions: [],
    effects: [],
    riskLevel,
    executionPermission,
    requiresWorldState: category !== 'system',
    requiresSimulation: executionPermission === 'simulation_only',
    requiresHumanApproval: executionPermission === 'ask_human'
  };
}

export const CAPABILITY_CONTRACTS: Record<string, CapabilityContract> = {
  observe: capability('observe', 'observation', 'low', 'read_only', 'Observe the current scene.'),
  scan: capability('scan', 'observation', 'low', 'read_only', 'Scan the current area.'),
  capture_image: capability('capture_image', 'observation', 'low', 'read_only', 'Capture an image from a sensor.'),
  read_sensor: capability('read_sensor', 'observation', 'low', 'read_only', 'Read current sensor state.'),
  detect_object: capability('detect_object', 'observation', 'low', 'simulation_only', 'Detect a target object.', ['objectRef']),
  locate_object: capability('locate_object', 'observation', 'low', 'simulation_only', 'Locate a target object.', ['objectRef']),
  inspect: capability('inspect', 'observation', 'low', 'read_only', 'Inspect the current scene or sensor stream.'),
  move: capability('move', 'motion', 'medium', 'simulation_only', 'Move the device.', ['targetZone']),
  move_to_pose: capability('move_to_pose', 'motion', 'medium', 'simulation_only', 'Move to a target pose.', ['targetZone']),
  return_home: capability('return_home', 'system', 'low', 'simulation_only', 'Return to the home pose.'),
  stop: capability('stop', 'system', 'medium', 'simulation_only', 'Stop the current activity.'),
  emergency_stop: capability('emergency_stop', 'safety', 'critical', 'blocked', 'Emergency stop.'),
  pick: capability('pick', 'manipulation', 'medium', 'simulation_only', 'Pick a target object.', ['objectRef']),
  place: capability('place', 'manipulation', 'medium', 'simulation_only', 'Place an object in a target zone.', ['targetZone']),
  grasp: capability('grasp', 'manipulation', 'medium', 'simulation_only', 'Grasp a target object.', ['objectRef']),
  release: capability('release', 'manipulation', 'medium', 'simulation_only', 'Release a held object.', ['targetZone']),
  insert: capability('insert', 'manipulation', 'high', 'ask_human', 'Insert an object precisely.'),
  align: capability('align', 'manipulation', 'high', 'ask_human', 'Align an object precisely.'),
  assemble: capability('assemble', 'manipulation', 'high', 'ask_human', 'Assemble an object.'),
  turn_on: capability('turn_on', 'actuation', 'low', 'simulation_only', 'Turn a device on.'),
  turn_off: capability('turn_off', 'actuation', 'low', 'simulation_only', 'Turn a device off.'),
  set_color: capability('set_color', 'actuation', 'low', 'simulation_only', 'Set output color.', [], ['color']),
  set_brightness: capability('set_brightness', 'actuation', 'low', 'simulation_only', 'Set brightness.', [], ['brightness']),
  set_speed: capability('set_speed', 'actuation', 'medium', 'simulation_only', 'Set speed.', [], ['speed']),
  set_temperature: capability('set_temperature', 'actuation', 'medium', 'simulation_only', 'Set temperature.', [], ['temperature']),
  set_value: capability('set_value', 'actuation', 'medium', 'simulation_only', 'Set a value.', [], ['value']),
  convey: capability('convey', 'transport', 'medium', 'simulation_only', 'Convey an item.'),
  transport_item: capability('transport_item', 'transport', 'medium', 'simulation_only', 'Transport an item.'),
  sort: capability('sort', 'transport', 'medium', 'simulation_only', 'Sort an item.'),
  route: capability('route', 'transport', 'medium', 'simulation_only', 'Route an item.'),
  measure: capability('measure', 'process', 'medium', 'simulation_only', 'Measure a sample.'),
  dispense: capability('dispense', 'process', 'high', 'simulation_only', 'Dispense a material.'),
  heat: capability('heat', 'process', 'high', 'simulation_only', 'Heat a sample.'),
  cool: capability('cool', 'process', 'medium', 'simulation_only', 'Cool a sample.'),
  test: capability('test', 'process', 'medium', 'simulation_only', 'Run a test sequence.'),
  record: capability('record', 'process', 'low', 'read_only', 'Record sensor output.'),
  collision_check: capability('collision_check', 'safety', 'medium', 'simulation_only', 'Validate collision constraints.'),
  workspace_check: capability('workspace_check', 'safety', 'medium', 'simulation_only', 'Validate workspace bounds.'),
  force_limit_check: capability('force_limit_check', 'safety', 'high', 'simulation_only', 'Validate force limits.'),
  speed_limit_check: capability('speed_limit_check', 'safety', 'high', 'simulation_only', 'Validate speed limits.'),
  simulation_check: capability('simulation_check', 'safety', 'low', 'simulation_only', 'Ensure simulation-only execution.'),
  human_approval_check: capability('human_approval_check', 'safety', 'high', 'ask_human', 'Require human approval.')
};

export function getCapabilityContract(id: string): CapabilityContract {
  return CAPABILITY_CONTRACTS[id];
}

export function getCapabilityContracts(ids: string[]): CapabilityContract[] {
  return ids.map(getCapabilityContract).filter((value): value is CapabilityContract => Boolean(value));
}
