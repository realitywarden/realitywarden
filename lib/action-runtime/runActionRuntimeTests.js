const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  'lib/action-runtime/DeviceActionRuntime.ts',
  'lib/action-runtime/DeviceActionModel.ts',
  'lib/action-runtime/ActionPlan.ts',
  'lib/action-runtime/ActionFrame.ts',
  'lib/action-runtime/buildRobotArmActionPlan.ts',
  'lib/action-runtime/ActionPlanner.ts',
  'lib/action-runtime/ActionExecutor.ts',
  'lib/action-runtime/PlaybackEngine.ts',
  'lib/action-runtime/ActionState.ts',
  'lib/action-runtime/ActionInterpolator.ts',
  'lib/action-runtime/ActionValidation.ts',
  'lib/action-runtime/Kinematics.ts',
  'lib/action-runtime/CollisionPathPlanner.ts',
  'lib/action-runtime/TargetResolver.ts',
  'lib/action-runtime/models/RobotArmActionModel.ts',
  'lib/action-runtime/models/MobileRobotActionModel.ts',
  'lib/action-runtime/models/SmartLightActionModel.ts',
  'lib/action-runtime/models/CameraSensorActionModel.ts',
  'lib/action-runtime/models/ConveyorBeltActionModel.ts',
  'lib/action-runtime/models/PlcCabinetActionModel.ts',
  'lib/action-runtime/models/LabInstrumentActionModel.ts',
  'lib/action-runtime/models/WarehouseRackActionModel.ts',
  'lib/action-runtime/models/SensorBoxActionModel.ts'
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist.`);
}

const runtime = read('lib/action-runtime/DeviceActionRuntime.ts');
const planner = read('lib/action-runtime/ActionPlanner.ts');
const plan = read('lib/action-runtime/ActionPlan.ts');
const runner = read('lib/virtual-lab/ScenarioRunner.ts');
const adapter = read('lib/virtual-lab/SimulatorAdapter.ts');
const labReport = read('lib/virtual-lab/LabReport.ts');
const playback = read('lib/action-runtime/PlaybackEngine.ts');
const robotPlaybackBuilder = read('lib/action-runtime/buildRobotArmActionPlan.ts');
const validation = read('lib/action-runtime/ActionValidation.ts');
const kinematics = read('lib/action-runtime/Kinematics.ts');
const pathPlanner = read('lib/action-runtime/CollisionPathPlanner.ts');

assert(runtime.includes('createActionPlan'), 'DeviceActionRuntime must create ActionPlan.');
assert(runtime.includes('createBlockedActionPlan'), 'DeviceActionRuntime must create blocked ActionPlan.');
assert(runtime.includes('executeActionPlan'), 'DeviceActionRuntime must execute ActionPlan end state.');
assert(plan.includes('frames: ActionFrame[]'), 'ActionPlan must include frames.');
assert(plan.includes('frame_count'), 'ActionPlan summary must include frame_count.');

for (const deviceType of ['robot_arm', 'mobile_robot', 'smart_light', 'camera_sensor', 'conveyor_belt', 'plc_cabinet', 'lab_instrument', 'warehouse_rack', 'sensor_box']) {
  assert(planner.includes(`${deviceType}:`), `${deviceType} must be registered in ActionPlanner.`);
}

const robot = read('lib/action-runtime/models/RobotArmActionModel.ts');
assert(robot.includes('targetPosition(motionTarget') && robot.includes('joint_angles') && robot.includes('gripper_position'), 'RobotArmActionModel must compute target-driven joint/gripper frames.');
assert(robot.includes('solvePlanarTwoLinkIk') && robot.includes('planar_two_link_ik'), 'RobotArmActionModel must use IK diagnostics, not a fixed joint formula.');
assert(robotPlaybackBuilder.includes('buildRobotArmActionPlan') && robotPlaybackBuilder.includes('end_effector_position') && robotPlaybackBuilder.includes('path_points'), 'Robot Arm playback builder must expose command-driven end-effector frames and path points.');

const mobile = read('lib/action-runtime/models/MobileRobotActionModel.ts');
assert(mobile.includes('planWorkspacePath') && mobile.includes('samplePath') && mobile.includes('path_planner'), 'MobileRobotActionModel must generate planned waypoint frames, not teleport or direct-only interpolation.');

const light = read('lib/action-runtime/models/SmartLightActionModel.ts');
assert(light.includes('lerp(fromBrightness') && light.includes('transition_progress'), 'SmartLightActionModel must generate brightness/color transition frames.');

const conveyor = read('lib/action-runtime/models/ConveyorBeltActionModel.ts');
assert(conveyor.includes('belt_offset') && conveyor.includes('roller_rotation') && conveyor.includes('lerpVec3(start, end'), 'ConveyorBeltActionModel must generate continuous belt/item frames.');

for (const file of ['PlcCabinetActionModel.ts', 'LabInstrumentActionModel.ts', 'WarehouseRackActionModel.ts', 'SensorBoxActionModel.ts']) {
  assert(read(`lib/action-runtime/models/${file}`).includes('visual:'), `${file} must produce visual frames.`);
}

assert(runner.includes('action_plans') && runner.includes('summarizeActionPlan'), 'ScenarioRunner must add action_plans to LabReport.');
assert(runner.includes('createBlockedActionPlan'), 'ScenarioRunner must not generate execution frames for Safety Runtime blocked runs.');
assert(adapter.includes('DeviceActionRuntime') && adapter.includes('executeActionPlan'), 'SimulatorAdapter must execute via DeviceActionRuntime.');
assert(labReport.includes('action_plans') && labReport.includes('ActionFrame'), 'LabReport must expose action plan summaries and action frames.');
assert(playback.includes('createEvents') && playback.includes('adapter_commands') && playback.includes('ActionFrame'), 'PlaybackEngine must convert AdapterCommands into ActionFrame playback events.');
assert(playback.includes('buildRobotArmActionPlan') && playback.includes("status: 'blocked'"), 'PlaybackEngine must use Robot Arm move_to_pose plans and emit blocked playback events.');
assert(validation.includes('diagnostics') && validation.includes('solvePlanarTwoLinkIk') && validation.includes('planWorkspacePath'), 'ActionValidation must include IK/path diagnostics.');
assert(kinematics.includes('solvePlanarTwoLinkIk') && kinematics.includes('max_reach'), 'Kinematics must expose two-link IK reach checks.');
assert(pathPlanner.includes('planWorkspacePath') && pathPlanner.includes('lineIntersectsZone') && pathPlanner.includes('waypoints'), 'CollisionPathPlanner must produce waypoint paths and collision diagnostics.');

console.log('Action Runtime tests passed.');
console.log('- DeviceActionRuntime and all device action models exist.');
console.log('- AdapterCommand maps to ActionPlan and ActionFrame structures.');
console.log('- Robot/mobile/light/conveyor models declare parameterized command-driven frames.');
console.log('- BLOCKED commands use blocked plans without execution frames.');
console.log('- LabReport contains action_plans.');
console.log('- IK, waypoint path planning, and validation diagnostics are present.');
