const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const protocolDir = path.join(root, 'lib', 'protocol');
const assetRoot = path.join(root, 'assets', 'devices');
const protocolExamplePath = path.join(root, 'examples', 'protocol', 'openreality-protocol-v0.1.catalog.json');
const protocolRunnableExamplePath = path.join(root, 'examples', 'protocol', 'openreality-protocol-v0.1.runnable.json');
const protocolSupportMatrixPath = path.join(root, 'examples', 'protocol', 'openreality-protocol-v0.1.support-matrix.json');
const protocolConsumerExamplePath = path.join(root, 'examples', 'protocol', 'openreality-protocol-v0.1.consumer-example.json');
const protocolAdapterIntakePath = path.join(root, 'examples', 'protocol', 'openreality-protocol-v0.1.adapter-intake.json');
const adapterSdkSummaryPath = path.join(root, 'examples', 'adapter-sdk', 'openreality-adapter-sdk-v0.1.intake-summary.json');
const adapterSdkStubPath = path.join(root, 'examples', 'adapter-sdk', 'simulation-adapter.stub.ts');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function readJson(file) {
  return JSON.parse(read(file));
}

const protocolFiles = [
  'OpenRealityProtocol.ts',
  'RealityAsset.ts',
  'DeviceManifest.ts',
  'ComponentGraph.ts',
  'CapabilityNormalizer.ts',
  'SafetyProfile.ts',
  'RuntimePermission.ts',
  'AdapterBinding.ts'
];

for (const file of protocolFiles) {
  assert(fs.existsSync(path.join(protocolDir, file)), `${file} missing from lib/protocol`);
}

const openRealityProtocolSource = read(path.join(protocolDir, 'OpenRealityProtocol.ts'));
const realityAssetSource = read(path.join(protocolDir, 'RealityAsset.ts'));
const capabilitySource = read(path.join(protocolDir, 'CapabilityNormalizer.ts'));
const componentGraphSource = read(path.join(protocolDir, 'ComponentGraph.ts'));
const runtimePermissionSource = read(path.join(protocolDir, 'RuntimePermission.ts'));
const packageJson = readJson(path.join(root, 'package.json'));

assert(openRealityProtocolSource.includes('openreality.protocol.v0.1'), 'Protocol version must be openreality.protocol.v0.1');
assert(openRealityProtocolSource.includes('PUBLIC_ALPHA_RUNNABLE_DEVICE_TYPES'), 'Protocol must expose Public Alpha runnable device types');
assert(openRealityProtocolSource.includes("'robot_arm'") && openRealityProtocolSource.includes("'smart_light'") && openRealityProtocolSource.includes("'camera_sensor'"), 'Protocol runnable device set must match Public Alpha support');

for (const symbol of ['buildRealityAsset', 'manifest', 'component_graph', 'normalized_capabilities', 'safety_profile', 'runtime_permissions', 'adapter_binding']) {
  assert(realityAssetSource.includes(symbol), `RealityAsset protocol object missing ${symbol}`);
}

for (const rawCapability of [
  'move_to_pose',
  'grasp',
  'release',
  'set_light',
  'set_brightness',
  'set_color',
  'capture_frame',
  'read_sensor',
  'read_register',
  'write_register',
  'start_belt',
  'sort_item'
]) {
  assert(capabilitySource.includes(rawCapability), `CapabilityNormalizer must cover ${rawCapability}`);
}

for (const componentKeyword of ['workspace', 'zone', 'object', 'indicator']) {
  assert(componentGraphSource.includes(componentKeyword), `ComponentGraph must include ${componentKeyword} nodes`);
}

assert(runtimePermissionSource.includes('real_device.execute') && runtimePermissionSource.includes('allowed: false'), 'RuntimePermission must keep real device execution disabled in Public Alpha');

const assetDirs = fs.readdirSync(assetRoot);
for (const assetId of assetDirs) {
  const meta = readJson(path.join(assetRoot, assetId, 'device.meta.json'));
  const manifest = readJson(path.join(assetRoot, assetId, 'asset.manifest.json'));
  const adapter = readJson(path.join(assetRoot, assetId, 'adapter.manifest.json'));
  assert(meta.profile_id, `${assetId} must expose profile_id for DeviceManifest`);
  assert(meta.capabilities.length > 0, `${assetId} must expose capabilities for CapabilityNormalizer`);
  assert(manifest.license && manifest.source, `${assetId} must expose source asset licensing info`);
  assert(adapter.interface === 'AdapterInterface', `${assetId} adapter binding must use AdapterInterface`);
}

assert(packageJson.scripts['test:protocol'] === 'node lib/protocol/runProtocolTests.js', 'package.json must expose test:protocol');
assert(packageJson.scripts['protocol:export'] === 'node scripts/export-protocol-catalog.cjs', 'package.json must expose protocol:export');
assert(packageJson.scripts['protocol:consume-example'] === 'npm run protocol:export && node scripts/build-protocol-consumer-example.cjs', 'package.json must expose protocol:consume-example');
assert(packageJson.scripts['protocol:adapter-intake-example'] === 'npm run protocol:consume-example && node scripts/build-adapter-intake-example.cjs', 'package.json must expose protocol:adapter-intake-example');
assert(packageJson.scripts['protocol:adapter-sdk-example'] === 'npm run protocol:adapter-intake-example && node scripts/build-adapter-sdk-example.cjs', 'package.json must expose protocol:adapter-sdk-example');
assert(packageJson.scripts.verify.includes('test:protocol'), 'verify must include test:protocol');
assert(fs.existsSync(protocolExamplePath), 'Protocol example catalog must exist under examples/protocol');
assert(fs.existsSync(protocolRunnableExamplePath), 'Runnable protocol example must exist under examples/protocol');
assert(fs.existsSync(protocolSupportMatrixPath), 'Protocol support matrix example must exist under examples/protocol');
assert(fs.existsSync(protocolConsumerExamplePath), 'Protocol consumer example must exist under examples/protocol');
assert(fs.existsSync(protocolAdapterIntakePath), 'Protocol adapter intake example must exist under examples/protocol');
assert(fs.existsSync(adapterSdkSummaryPath), 'Adapter SDK summary example must exist under examples/adapter-sdk');
assert(fs.existsSync(adapterSdkStubPath), 'Adapter SDK stub example must exist under examples/adapter-sdk');

const protocolExample = readJson(protocolExamplePath);
const protocolRunnableExample = readJson(protocolRunnableExamplePath);
const protocolSupportMatrix = readJson(protocolSupportMatrixPath);
const protocolConsumerExample = readJson(protocolConsumerExamplePath);
const protocolAdapterIntakeExample = readJson(protocolAdapterIntakePath);
const adapterSdkSummary = readJson(adapterSdkSummaryPath);
const adapterSdkStubSource = read(adapterSdkStubPath);
assert(Array.isArray(protocolExample) && protocolExample.length > 0, 'Protocol example catalog must contain exported Reality Assets');
assert(protocolExample.every((asset) => asset.protocol_version === 'openreality.protocol.v0.1'), 'Protocol example catalog must keep protocol version');
assert(protocolExample.some((asset) => asset.manifest.public_alpha_runnable === true), 'Protocol example catalog must mark runnable assets');
assert(protocolExample.some((asset) => asset.device_type === 'robot_arm'), 'Protocol example catalog must include robot_arm');
assert(protocolExample.some((asset) => asset.device_type === 'smart_light'), 'Protocol example catalog must include smart_light');
assert(protocolExample.some((asset) => asset.device_type === 'camera_sensor'), 'Protocol example catalog must include camera_sensor');
assert(Array.isArray(protocolRunnableExample) && protocolRunnableExample.length === 3, 'Runnable protocol example must only expose the three Public Alpha runnable assets');
assert(protocolRunnableExample.every((asset) => asset.manifest.public_alpha_runnable === true), 'Runnable protocol example must contain only runnable assets');
assert(Array.isArray(protocolSupportMatrix) && protocolSupportMatrix.length === protocolExample.length, 'Protocol support matrix must cover the full catalog');
assert(protocolSupportMatrix.some((entry) => entry.device_type === 'mobile_robot' && entry.public_alpha_runnable === false), 'Protocol support matrix must keep non-runnable device boundaries explicit');
assert.equal(protocolConsumerExample.protocol_version, 'openreality.protocol.v0.1', 'Protocol consumer example must keep protocol version');
assert.equal(protocolConsumerExample.consumer_summary.runnable_assets, 3, 'Protocol consumer example must see three runnable Public Alpha assets');
assert.equal(protocolConsumerExample.public_alpha_boundary.real_device_execution_enabled, false, 'Protocol consumer example must keep real-device execution disabled');
assert(protocolConsumerExample.adapter_intake_decisions.some((entry) => entry.device_type === 'robot_arm' && entry.decision === 'accept_simulation_runtime'), 'Protocol consumer example must accept robot_arm into simulation runtime');
assert(protocolConsumerExample.adapter_intake_decisions.some((entry) => entry.device_type === 'mobile_robot' && entry.decision === 'keep_protocol_only_until_runtime_support'), 'Protocol consumer example must keep mobile_robot protocol-only in Public Alpha');
assert.equal(protocolAdapterIntakeExample.protocol_version, 'openreality.protocol.v0.1', 'Protocol adapter intake example must keep protocol version');
assert.equal(protocolAdapterIntakeExample.summary.accepted_assets, 3, 'Protocol adapter intake example must only accept the three Public Alpha runnable assets');
assert.equal(protocolAdapterIntakeExample.summary.real_device_execution_enabled, false, 'Protocol adapter intake example must keep real device execution disabled');
assert(protocolAdapterIntakeExample.simulation_runtime_accepts.some((entry) => entry.device_type === 'smart_light' && entry.accepted === true), 'Protocol adapter intake example must accept smart_light for simulation runtime');
assert(protocolAdapterIntakeExample.protocol_only_assets.some((entry) => entry.device_type === 'warehouse_rack' && entry.accepted === false), 'Protocol adapter intake example must keep warehouse_rack protocol-only');
assert.equal(adapterSdkSummary.protocol_version, 'openreality.protocol.v0.1', 'Adapter SDK summary must keep protocol version');
assert.deepEqual(adapterSdkSummary.accepted_device_types.sort(), ['camera_sensor', 'robot_arm', 'smart_light'], 'Adapter SDK summary must keep the Public Alpha runnable device set');
assert(adapterSdkStubSource.includes('SimulationOnlyAdapterStub'), 'Adapter SDK stub must expose a simulation-only adapter example');
assert(adapterSdkStubSource.includes('protocol-only in Public Alpha'), 'Adapter SDK stub must keep protocol-only assets out of the runnable path');
assert(adapterSdkStubSource.includes('runtime_mode: \'simulation-only\''), 'Adapter SDK stub must keep the simulation-only boundary explicit');

console.log('Protocol tests passed.');
console.log('- Open Reality Protocol v0.1 code layer exists under lib/protocol.');
console.log('- Built-in device assets can be represented as protocol Reality Assets.');
console.log('- Public Alpha runnable boundaries are encoded in the protocol layer.');
console.log('- A concrete exported protocol catalog is available under examples/protocol.');
console.log('- Runnable and support-matrix protocol artifacts are available for consumer inspection.');
console.log('- A developer-facing protocol consumer example is available for adapter/runtime intake decisions.');
console.log('- A protocol-to-adapter intake example is available for SDK boundary guidance.');
console.log('- A minimal Adapter SDK stub example is available for developer onboarding.');
