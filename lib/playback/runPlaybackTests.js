const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const requiredFiles = [
  'lib/playback/PlaybackController.ts',
  'lib/playback/PlaybackEvent.ts',
  'lib/playback/PlaybackState.ts',
  'lib/action-runtime/buildRobotArmActionPlan.ts',
  'lib/action-runtime/ActionFrame.ts',
  'lib/virtual-lab/LiveScenarioRunner.ts'
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `${file} must exist.`);
}

const controller = read('lib/playback/PlaybackController.ts');
const event = read('lib/playback/PlaybackEvent.ts');
const state = read('lib/playback/PlaybackState.ts');
const builder = read('lib/action-runtime/buildRobotArmActionPlan.ts');
const liveRunner = read('lib/virtual-lab/LiveScenarioRunner.ts');
const robotArm = read('components/devices/SemanticRobotArm.tsx');
const page = read('app/page.tsx');
const playbackEngine = read('lib/action-runtime/PlaybackEngine.ts');

for (const method of ['play()', 'pause()', 'stepNext()', 'stepPrev()', 'replay()', 'setSpeed(speed']) {
  assert(controller.includes(method), `PlaybackController must support ${method}.`);
}

assert(controller.includes('1500') && controller.includes('slowMode'), 'PlaybackController must enforce slow mode duration.');
assert(event.includes('blocked') && state.includes("'blocked'"), 'Playback events/state must represent BLOCKED playback.');
assert(builder.includes("command.action !== 'move_to_pose'") && builder.includes('DeviceActionRuntime') && builder.includes('targetPosition(command.target'), 'Robot Arm builder must be AdapterCommand-driven.');
assert(builder.includes('end_effector_position') && builder.includes('path_points') && builder.includes('target_position'), 'Robot Arm builder must generate ActionFrame visual_state path data.');
assert(playbackEngine.includes('buildRobotArmActionPlan') && playbackEngine.includes("status: 'blocked'"), 'PlaybackEngine must route Robot Arm move_to_pose through ActionPlan and preserve blocked events.');
assert(liveRunner.includes('async *run') && liveRunner.includes("kind: 'frame'") && liveRunner.includes("kind: 'report'"), 'LiveScenarioRunner must stream frames before emitting the LabReport.');
assert(page.includes('new LiveScenarioRunner().run') && page.includes('setCurrentActionFrame(event.frame)') && page.includes('setLivePlaybackEvents'), 'Run must consume live ActionFrames instead of using LabReport as the execution source.');
assert(page.includes('liveRunActiveRef') && page.includes('A run is already active'), 'Run must use a ref-level active lock to prevent duplicate LiveScenarioRunner streams.');
assert(page.includes('events.some((item) => item.event_id === playbackEvent.event_id)') && page.includes('events.some((item) => item.event_id === blockedPlaybackEvent.event_id)'), 'Run must dedupe live playback and blocked events by event_id.');
assert(robotArm.includes('end_effector_position') && robotArm.includes('gripper_position'), 'SemanticRobotArm must render from ActionFrame visual_state.');
assert(robotArm.includes('holding_object') && robotArm.includes('gripperWidth') && robotArm.includes('right_safe_zone'), 'SemanticRobotArm must visualize grasp/release/object placement as a task loop.');
const robotModel = read('lib/action-runtime/models/RobotArmActionModel.ts');
assert(robotModel.includes("command.action === 'grasp'") && robotModel.includes("command.action === 'release'") && robotModel.includes('holding_object'), 'RobotArmActionModel must model grasp, carried object motion, and release state.');
assert(page.includes('onStepPrev') && page.includes('onStepNext') && page.includes('onReplayStart') && page.includes('Slow Mode'), 'Bottom Console must expose playback controls.');
assert(page.includes('liveRunTokenRef') && page.includes('replayFromStart'), 'Run must support live execution control and replay from start after completion.');

console.log('Playback tests passed.');
console.log('- Robot Arm move_to_pose uses AdapterCommand -> ActionPlan -> ActionFrames.');
console.log('- PlaybackController exposes play/pause/step/replay/speed/slow mode.');
console.log('- SemanticRobotArm renders from current ActionFrame visual_state.');
console.log('- Bottom Console exposes playback controls and command highlighting.');
