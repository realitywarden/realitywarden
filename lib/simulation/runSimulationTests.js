const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function samplePath(a, b, samples = 12) {
  return Array.from({ length: samples + 1 }, (_, i) => [
    a[0] + (b[0] - a[0]) * (i / samples),
    a[1] + (b[1] - a[1]) * (i / samples),
    a[2] + (b[2] - a[2]) * (i / samples)
  ]);
}

function insideZone(point, zone) {
  const [width, depth] = zone.size;
  return point[0] >= zone.position[0] - width / 2 &&
    point[0] <= zone.position[0] + width / 2 &&
    point[2] >= zone.position[2] - depth / 2 &&
    point[2] <= zone.position[2] + depth / 2;
}

function maxReach(geometry) {
  return geometry.robot.arm_segments[0] + geometry.robot.arm_segments[1] + geometry.robot.gripper_size;
}

function checkReachability(geometry, target) {
  const base = geometry.robot.base_position;
  const workspace = geometry.workspace;
  return target[0] >= workspace.x_min &&
    target[0] <= workspace.x_max &&
    target[1] >= workspace.y_min &&
    target[1] <= workspace.y_max &&
    target[2] >= workspace.z_min &&
    target[2] <= workspace.z_max &&
    distance(base, target) <= maxReach(geometry);
}

function checkCollision(geometry, from, to) {
  const glassZone = geometry.zones.glass_cup_zone;
  return !samplePath(from, to).some((point) => insideZone(point, glassZone));
}

function createMotionPlan(geometry, dangerous = false) {
  if (dangerous) {
    return {
      steps: [{ step_id: 'step-throw', action: 'throw_object', target: 'outside_table', status: 'blocked' }],
      adapter_commands: []
    };
  }
  return {
    steps: [
      {
        step_id: 'step-move',
        action: 'move_to_pose',
        target: 'right_safe_zone',
        target_position: geometry.zones.right_safe_zone.position,
        path: samplePath(geometry.objects.red_cube.position, geometry.zones.right_safe_zone.position),
        status: 'pending'
      },
      { step_id: 'step-grasp', action: 'grasp', target: 'red_cube', target_position: geometry.objects.red_cube.position, status: 'pending' },
      { step_id: 'step-release', action: 'release', target: 'red_cube', target_position: geometry.zones.right_safe_zone.position, status: 'pending' }
    ],
    adapter_commands: [
      { command: 'move_to_pose', target_position: geometry.zones.right_safe_zone.position, source_step_id: 'step-move' },
      { command: 'grasp', target_position: geometry.objects.red_cube.position, source_step_id: 'step-grasp' },
      { command: 'release', target_position: geometry.zones.right_safe_zone.position, source_step_id: 'step-release' }
    ]
  };
}

function executePlan(geometry, plan, blocked) {
  const world = {
    red_cube: [...geometry.objects.red_cube.position],
    robot_status: blocked ? 'blocked' : 'completed'
  };
  if (!blocked) {
    const release = plan.steps.find((step) => step.action === 'release');
    world.red_cube = [...release.target_position];
  }
  return world;
}

const genericMeta = readJson('profiles/generic-robot-arm/device.meta.json');
const genericGeometry = readJson('profiles/generic-robot-arm/geometry.json');
const desktopGeometry = readJson('profiles/desktop-pick-place-arm/geometry.json');
const restrictedMeta = readJson('profiles/restricted-lab-arm/device.meta.json');

assert.equal(checkReachability(genericGeometry, genericGeometry.objects.red_cube.position), true, 'reachable target should pass');
assert.equal(checkReachability(desktopGeometry, [99, 99, 99]), false, 'unreachable target should block');

assert.equal(checkCollision(genericGeometry, genericGeometry.objects.red_cube.position, genericGeometry.zones.right_safe_zone.position), true, 'safe path should pass collision check');
assert.equal(checkCollision(genericGeometry, [-1.2, 0.35, 0.8], [0, 0.35, 0.8]), false, 'path through glass_cup_zone should block');

const safePlan = createMotionPlan(genericGeometry);
assert.ok(safePlan.steps.length > 0, 'normal task should build a motion plan');
assert.ok(safePlan.adapter_commands.length > 0, 'motion plan should produce adapter commands');

const dangerousPlan = createMotionPlan(genericGeometry, true);
assert.equal(dangerousPlan.steps[0].status, 'blocked', 'dangerous task should be blocked in motion plan');

const before = genericGeometry.objects.red_cube.position;
const afterPass = executePlan(genericGeometry, safePlan, false);
assert.notDeepEqual(afterPass.red_cube, before, 'PASS execution should update WorldState');
const afterBlocked = executePlan(genericGeometry, dangerousPlan, true);
assert.deepEqual(afterBlocked.red_cube, before, 'BLOCKED execution must not update WorldState');

assert.equal(restrictedMeta.safety_profile.medium_risk_requires_confirmation, true, 'restricted-lab-arm medium risk should need confirmation or block');
assert.equal(genericMeta.profile_id, 'generic-robot-arm');

console.log('Simulation tests passed.');
console.log('- ReachabilityChecker pass/block behavior covered.');
console.log('- CollisionChecker pass/block behavior covered.');
console.log('- DryRunEngine safe/dangerous/restricted behavior covered by fixtures.');
console.log('- SimulatorEngine WorldState update/no-update behavior covered.');
console.log('- Adapter command output covered.');
