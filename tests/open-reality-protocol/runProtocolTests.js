const assert = require('node:assert/strict');
const path = require('node:path');

const compiledRoot = process.argv[2];

if (!compiledRoot) {
  throw new Error('Missing compiled output directory argument for protocol tests.');
}

const protocol = require(path.resolve(compiledRoot, 'lib/open-reality-protocol/index.js'));
const manifests = require(path.resolve(compiledRoot, 'lib/open-reality-runtime/deviceManifests.js'));

const {
  OPEN_REALITY_PROTOCOL_SPEC,
  PROTOCOL_RUNNABLE_SUPPORT_LEVELS,
  isProtocolRunnableManifest,
  isProtocolRunnableSupportLevel,
  toProtocolExecutionPermission
} = protocol;

assert.equal(OPEN_REALITY_PROTOCOL_SPEC.protocolName, 'Open Reality Protocol', 'Protocol name must be Open Reality Protocol.');
assert.equal(OPEN_REALITY_PROTOCOL_SPEC.version, '0.1', 'Protocol version must be 0.1.');
assert.equal(OPEN_REALITY_PROTOCOL_SPEC.runtimeBoundary, 'simulation_first', 'Protocol must remain simulation-first.');
assert.equal(OPEN_REALITY_PROTOCOL_SPEC.realDeviceExecution, false, 'Protocol must keep realDeviceExecution=false.');
assert(Array.isArray(OPEN_REALITY_PROTOCOL_SPEC.executionModes), 'Protocol executionModes must be exported.');
assert(!OPEN_REALITY_PROTOCOL_SPEC.executionModes.includes('real_execution'), 'Protocol executionModes must not include real_execution.');

for (const requiredExport of [
  'OPEN_REALITY_PROTOCOL_SPEC',
  'PROTOCOL_RUNNABLE_SUPPORT_LEVELS',
  'isProtocolRunnableManifest',
  'isProtocolRunnableSupportLevel',
  'toProtocolExecutionPermission'
]) {
  assert(requiredExport in protocol, `Missing protocol export: ${requiredExport}`);
}

for (const supportLevel of ['simulation_only', 'read_only']) {
  assert(PROTOCOL_RUNNABLE_SUPPORT_LEVELS.includes(supportLevel), `Runnable support levels must include ${supportLevel}.`);
  assert.equal(isProtocolRunnableSupportLevel(supportLevel), true, `${supportLevel} must be runnable at protocol level.`);
}

for (const supportLevel of ['coming_soon', 'unsupported']) {
  assert.equal(isProtocolRunnableSupportLevel(supportLevel), false, `${supportLevel} must not be runnable at protocol level.`);
}

const robotArm = manifests.getOpenRealityDeviceManifest('robot_arm');
const smartLight = manifests.getOpenRealityDeviceManifest('smart_light');
const cameraSensor = manifests.getOpenRealityDeviceManifest('camera_sensor');
const mobileRobot = manifests.getOpenRealityDeviceManifest('mobile_robot');
const conveyorBelt = manifests.getOpenRealityDeviceManifest('conveyor_belt');
const plcCabinet = manifests.getOpenRealityDeviceManifest('plc_cabinet');

for (const manifest of [robotArm, smartLight, cameraSensor, mobileRobot, conveyorBelt, plcCabinet]) {
  assert.equal(manifest.adapter.realAdapterEnabled, false, `${manifest.deviceId} must keep real adapter execution disabled.`);
}

assert.equal(isProtocolRunnableManifest(robotArm), true, 'robot_arm must be runnable at protocol level.');
assert.equal(isProtocolRunnableManifest(smartLight), true, 'smart_light must be runnable at protocol level.');
assert.equal(isProtocolRunnableManifest(cameraSensor), true, 'camera_sensor must be runnable at protocol level.');
assert.equal(isProtocolRunnableManifest(mobileRobot), false, 'mobile_robot must remain not runnable at protocol level.');
assert.equal(isProtocolRunnableManifest(conveyorBelt), false, 'conveyor_belt must remain not runnable at protocol level.');
assert.equal(isProtocolRunnableManifest(plcCabinet), false, 'plc_cabinet must remain not runnable at protocol level.');

assert.equal(toProtocolExecutionPermission(robotArm), 'simulation_only', 'robot_arm must compile to simulation_only permission.');
assert.equal(toProtocolExecutionPermission(smartLight), 'simulation_only', 'smart_light must compile to simulation_only permission.');
assert.equal(toProtocolExecutionPermission(cameraSensor), 'read_only', 'camera_sensor must compile to read_only permission.');
assert.equal(toProtocolExecutionPermission(mobileRobot), 'blocked', 'coming_soon devices must stay blocked at protocol boundary.');

console.log('Open Reality Protocol tests passed.');
console.log('- Protocol version is 0.1.');
console.log('- realDeviceExecution remains false.');
console.log('- Required protocol contracts are exported.');
console.log('- executionModes do not include real_execution.');
console.log('- Protocol exports are consumable after compilation.');
console.log('- Coming Soon devices are not marked runnable.');
