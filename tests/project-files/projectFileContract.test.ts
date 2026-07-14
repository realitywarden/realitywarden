import assert from 'node:assert/strict';
import { MAX_PROJECT_FILE_BYTES, parseOpenRealityProjectText, serializeOpenRealityProjectFile, validateLabWorkspaceFile, validateOpenRealityProjectFile } from '../../lib/project/ProjectFileContract';

function fixture() {
  const device = {
    id: 'workspace-device-1', label: 'Robot Arm 1', profileId: 'virtual-robot-arm', deviceType: 'robot_arm', slot: 0,
    position: [0, 0, 0], current_state: { joint_angle: 0 }, last_run_result: 'blocked',
    config: { enabled: true, adapter_target_id: 'robot-arm-01', max_speed: 'slow', force_limit: 'low', forbidden_zones: ['restricted-zone'] }
  };
  const workspace = {
    file_type: 'open_reality_lab_workspace', version: 1, saved_at: '2026-07-14T00:00:00.000Z', language: 'en',
    selected_profile_id: 'virtual-robot-arm', selected_scenario_id: 'robot-arm-pick-place-safe', selected_workspace_device_id: device.id,
    prompt: 'Move the cube.', devices: [device], custom_actions: [], manual_imports: []
  };
  return {
    project: { name: 'Contract fixture', file_type: 'open_reality_desktop_project', version: 1 }, devices: [device],
    scenarios: [{ id: 'robot-arm-pick-place-safe', device_profile: 'virtual-robot-arm', prompt: 'Move the cube.', expected_safety_result: 'pass' }],
    profiles: [{ id: 'virtual-robot-arm', device_type: 'robot_arm', label: 'Robot Arm' }], workspace, lab_reports: [],
    metadata: { saved_at: '2026-07-14T00:00:00.000Z', app: 'RealityWarden Desktop', real_device_execution_enabled: false }
  };
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function expectSchemaRejection(value: unknown, detail: RegExp) {
  const result = validateOpenRealityProjectFile(value);
  assert.equal(result.ok, false);
  if (!result.ok) { assert.equal(result.code, 'invalid_schema'); assert.match(result.detail, detail); }
}

const original = fixture();
const serialized = serializeOpenRealityProjectFile(original);
if (!serialized.ok) throw new Error(serialized.detail);
assert.equal(serialized.ok, true, 'a valid project must serialize');
const parsed = parseOpenRealityProjectText(serialized.value);
if (!parsed.ok) throw new Error(parsed.detail);
assert.equal(parsed.ok, true, 'serialized project must parse and validate');
assert.deepEqual(parsed.value, original, 'save/open must preserve the exact project document');

const invalidJson = parseOpenRealityProjectText('{');
assert.equal(invalidJson.ok, false);
if (!invalidJson.ok) assert.equal(invalidJson.code, 'invalid_json');
const unsafeMetadata = clone(original);
unsafeMetadata.metadata.real_device_execution_enabled = true;
expectSchemaRejection(unsafeMetadata, /must remain false/);
expectSchemaRejection({ ...clone(original), surprise: true }, /surprise is not allowed/);
const invalidSpeed = clone(original);
invalidSpeed.workspace.devices[0].config.max_speed = 'unlimited';
invalidSpeed.devices = invalidSpeed.workspace.devices;
expectSchemaRejection(invalidSpeed, /max_speed is invalid/);
const duplicateDevice = clone(original);
duplicateDevice.workspace.devices.push(clone(duplicateDevice.workspace.devices[0]));
duplicateDevice.devices = duplicateDevice.workspace.devices;
expectSchemaRejection(duplicateDevice, /duplicate id/);
const missingSelection = clone(original);
missingSelection.workspace.selected_workspace_device_id = 'missing-device';
expectSchemaRejection(missingSelection, /does not reference/);
const divergentDevices = clone(original);
divergentDevices.devices[0].label = 'Tampered copy';
expectSchemaRejection(divergentDevices, /must exactly match/);
const ambiguousAsset = clone(original);
const ambiguousDevice = ambiguousAsset.workspace.devices[0] as typeof ambiguousAsset.workspace.devices[number] & { assetId?: string };
ambiguousDevice.assetId = 'asset-a';
ambiguousAsset.devices = ambiguousAsset.workspace.devices;
expectSchemaRejection(ambiguousAsset, /must match assetId/);
const nonFinite = clone(original);
nonFinite.workspace.devices[0].position[0] = Number.POSITIVE_INFINITY;
nonFinite.devices = nonFinite.workspace.devices;
expectSchemaRejection(nonFinite, /finite tuple/);
const pollutionText = serialized.value.replace('"joint_angle": 0', '"constructor": { "polluted": true }');
const pollution = parseOpenRealityProjectText(pollutionText);
assert.equal(pollution.ok, false);
if (!pollution.ok) assert.match(pollution.detail, /constructor is forbidden/);
assert.equal(({} as { polluted?: boolean }).polluted, undefined, 'validation must not mutate object prototypes');
const workspaceResult = validateLabWorkspaceFile({ ...clone(original.workspace), fallback: true });
assert.equal(workspaceResult.ok, false);
if (!workspaceResult.ok) assert.match(workspaceResult.detail, /fallback is not allowed/);
const oversized = parseOpenRealityProjectText(' '.repeat(MAX_PROJECT_FILE_BYTES + 1));
assert.equal(oversized.ok, false);
if (!oversized.ok) assert.equal(oversized.code, 'file_too_large');

console.log('Project file contract tests passed (13 cases).');
console.log('- Valid files round-trip exactly through the production parser and serializer.');
console.log('- Unknown, divergent, oversized, unsafe, non-finite, duplicate, and prototype-polluting input is rejected without repair.');
