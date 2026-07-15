import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createImportedAsset, type OpenRealityDeviceFile } from '../../lib/assets/DeviceAssetImporter';
import { createProjectAutosaveService, LEGACY_AUTOSAVE_KEY, type ProjectAutosaveBackend } from '../../lib/project/ProjectAutosaveStore';
import { MAX_PROJECT_FILE_BYTES, parseOpenRealityProjectText, serializeOpenRealityProjectFile, validateLabWorkspaceFile, validateOpenRealityProjectFile } from '../../lib/project/ProjectFileContract';

function readJson(relative: string) { return JSON.parse(fs.readFileSync(relative, 'utf8')) as Record<string, unknown>; }

function portableImportedAsset() {
  const assetId = 'user-sensor-box';
  const manifest = { ...readJson('assets/devices/generic-sensor-box/asset.manifest.json'), asset_id: assetId, display_name: 'User Sensor Box', brand: 'user-owned', source: 'contract-test' };
  const deviceMeta = { ...readJson('assets/devices/generic-sensor-box/device.meta.json'), profile_id: assetId, device_id: `imported-${assetId}`, display_name: 'User Sensor Box' };
  const adapterManifest = { ...readJson('assets/devices/generic-sensor-box/adapter.manifest.json'), adapter_id: `simulator-${assetId}` };
  const safe = { ...readJson('assets/devices/generic-sensor-box/scenarios/safe.json'), id: `${assetId}-safe`, device_profile: assetId };
  const unsafe = { ...readJson('assets/devices/generic-sensor-box/scenarios/unsafe.json'), id: `${assetId}-unsafe`, device_profile: assetId };
  return { manifest, deviceMeta, geometry: readJson('assets/devices/generic-sensor-box/geometry.json'), adapterManifest, scenarios: { safe, unsafe } };
}

function importFileFixture(): OpenRealityDeviceFile {
  const asset = portableImportedAsset();
  const manifest = asset.manifest as Record<string, unknown>;
  return {
    asset_manifest: asset.manifest,
    device_meta: asset.deviceMeta,
    geometry: asset.geometry,
    adapter_manifest: asset.adapterManifest,
    scenarios: [asset.scenarios.safe, asset.scenarios.unsafe],
    license: { name: String(manifest.license), source: String(manifest.source) }
  } as unknown as OpenRealityDeviceFile;
}

function fixture() {
  const device = {
    id: 'workspace-device-1', label: 'Robot Arm 1', profileId: 'virtual-robot-arm', deviceType: 'robot_arm', slot: 0,
    position: [0, 0, 0], current_state: { joint_angle: 0 }, last_run_result: 'blocked',
    config: { enabled: true, adapter_target_id: 'robot-arm-01', max_speed: 'slow', force_limit: 'low', forbidden_zones: ['restricted-zone'] }
  };
  const workspace = {
    file_type: 'open_reality_lab_workspace', version: 2, saved_at: '2026-07-14T00:00:00.000Z', language: 'en',
    selected_profile_id: 'virtual-robot-arm', selected_scenario_id: 'robot-arm-pick-place-safe', selected_workspace_device_id: device.id,
    prompt: 'Move the cube.', devices: [device], imported_assets: [portableImportedAsset()], custom_actions: [], manual_imports: []
  };
  return {
    project: { name: 'Contract fixture', file_type: 'open_reality_desktop_project', version: 2 }, devices: [device],
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
const embeddedModel = clone(original);
(embeddedModel.workspace.imported_assets[0].manifest as unknown as Record<string, unknown>).visual_model = { type: 'glb', path: 'data:model/gltf-binary;base64,AA==' };
const embeddedSerialized = serializeOpenRealityProjectFile(embeddedModel);
if (!embeddedSerialized.ok) throw new Error(embeddedSerialized.detail);
const embeddedParsed = parseOpenRealityProjectText(embeddedSerialized.value);
if (!embeddedParsed.ok) throw new Error(embeddedParsed.detail);
assert.deepEqual(embeddedParsed.value, embeddedModel, 'embedded model bytes must survive an exact project round-trip');

const legacy = clone(original);
legacy.project.version = 1;
legacy.workspace.version = 1;
const legacyWorkspace = legacy.workspace as unknown as Record<string, unknown>;
delete legacyWorkspace.imported_assets;
const migrated = validateOpenRealityProjectFile(legacy);
assert.equal(migrated.ok, true, 'v1 projects must migrate explicitly');
if (migrated.ok) {
  assert.equal((migrated.value.project as { version: number }).version, 2);
  assert.equal((migrated.value.workspace as { version: number }).version, 2);
  assert.deepEqual((migrated.value.workspace as { imported_assets: unknown[] }).imported_assets, []);
}

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
const realAsset = clone(original);
(realAsset.workspace.imported_assets[0].adapterManifest as unknown as Record<string, unknown>).real_device_enabled = true;
expectSchemaRejection(realAsset, /real_device_enabled must remain false/);
const externalModel = clone(original);
(externalModel.workspace.imported_assets[0].manifest as unknown as Record<string, unknown>).visual_model = { type: 'glb', path: 'blob:machine-local' };
expectSchemaRejection(externalModel, /embedded base64 model/);
const duplicateAsset = clone(original);
duplicateAsset.workspace.imported_assets.push(clone(duplicateAsset.workspace.imported_assets[0]));
expectSchemaRejection(duplicateAsset, /duplicate id/);
assert.doesNotThrow(() => createImportedAsset(importFileFixture()), 'valid simulator-only imported assets must pass the authoritative importer');
const realImport = importFileFixture();
realImport.adapter_manifest.real_device_enabled = true;
assert.throws(() => createImportedAsset(realImport), /real_device_enabled must remain false/);
const unknownMeta = importFileFixture();
(unknownMeta.device_meta as Record<string, unknown>).silent_override = true;
assert.throws(() => createImportedAsset(unknownMeta), /Unrecognized key/);
const unknownGeometry = importFileFixture();
((unknownGeometry.geometry as { workspace: Record<string, unknown> }).workspace).silent_fallback = true;
assert.throws(() => createImportedAsset(unknownGeometry), /Unrecognized key/);
const machineLocalImport = importFileFixture();
machineLocalImport.asset_manifest.visual_model = { type: 'glb', path: 'C:\\models\\device.glb' };
assert.throws(() => createImportedAsset(machineLocalImport), /selected locally or embedded/);
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

async function runAutosaveTests() {
  const durable = new Map<string, string>();
  const legacyData = new Map<string, string>([[LEGACY_AUTOSAVE_KEY, 'legacy-v1']]);
  const backend: ProjectAutosaveBackend = {
    get: async () => durable.get('current'),
    put: async (text) => { durable.set('current', text); },
    delete: async () => { durable.delete('current'); }
  };
  const legacyStorage = {
    getItem: (key: string) => legacyData.get(key) ?? null,
    removeItem: (key: string) => { legacyData.delete(key); }
  };
  const autosave = createProjectAutosaveService(backend, legacyStorage);
  assert.deepEqual(await autosave.load(), { text: 'legacy-v1', source: 'legacy-localstorage' }, 'legacy autosaves must remain recoverable');
  await autosave.save('project-v2');
  assert.equal(legacyData.has(LEGACY_AUTOSAVE_KEY), false, 'legacy bytes are removed only after durable save succeeds');
  assert.deepEqual(await autosave.load(), { text: 'project-v2', source: 'indexeddb' });
  await autosave.discard();
  assert.equal(await autosave.load(), null, 'explicit discard must clear durable and legacy stores');
  const failingAutosave = createProjectAutosaveService({ get: async () => { throw new Error('unavailable'); }, put: async () => { throw new Error('unavailable'); }, delete: async () => { throw new Error('unavailable'); } }, legacyStorage);
  await assert.rejects(() => failingAutosave.load(), /unavailable/, 'storage failure without legacy data must remain explicit');
}

runAutosaveTests().then(() => {
  console.log('Project file contract tests passed (28 cases).');
  console.log('- v2 files preserve imported assets exactly; v1 files migrate explicitly to v2.');
  console.log('- Unknown, divergent, oversized, unsafe, non-portable, duplicate, and prototype-polluting input is rejected without repair.');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
