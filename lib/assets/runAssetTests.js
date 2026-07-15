const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const assetRoot = path.join(root, 'assets', 'devices');
const expected = [
  'generic-industrial-robot-arm',
  'generic-agv-mobile-robot',
  'generic-ptz-camera',
  'generic-conveyor-belt',
  'generic-plc-cabinet',
  'generic-smart-light-panel',
  'generic-lab-instrument',
  'generic-warehouse-rack',
  'generic-sensor-box'
];
const independentTypes = ['plc_cabinet', 'lab_instrument', 'warehouse_rack', 'sensor_box'];
const expectedTypes = new Set();

for (const assetId of expected) {
  const dir = path.join(assetRoot, assetId);
  for (const file of ['asset.manifest.json', 'device.meta.json', 'geometry.json', 'adapter.manifest.json', 'safety.rules.ts', 'README.md']) {
    assert(fs.existsSync(path.join(dir, file)), `${assetId} missing ${file}`);
  }
  assert(fs.existsSync(path.join(dir, 'scenarios', 'safe.json')), `${assetId} missing safe scenario`);
  assert(fs.existsSync(path.join(dir, 'scenarios', 'unsafe.json')), `${assetId} missing unsafe scenario`);

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'asset.manifest.json'), 'utf8'));
  assert.equal(manifest.asset_id, assetId, `${assetId} manifest id mismatch`);
  assert(manifest.license, `${assetId} license must not be empty`);
  assert(['generic', 'user-owned', 'vendor-authorized'].includes(manifest.brand), `${assetId} brand must be allowed`);
  assert.equal(manifest.brand, 'generic', `${assetId} built-in brand must be generic`);
  assert.equal(manifest.visual_model.type, 'procedural_fallback', `${assetId} fallback visual model must be available`);
  assert.deepEqual(manifest.allowed_use, ['simulation', 'development', 'testing'], `${assetId} allowed use mismatch`);

  const safe = JSON.parse(fs.readFileSync(path.join(dir, 'scenarios', 'safe.json'), 'utf8'));
  const unsafe = JSON.parse(fs.readFileSync(path.join(dir, 'scenarios', 'unsafe.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'device.meta.json'), 'utf8'));
  const geometry = JSON.parse(fs.readFileSync(path.join(dir, 'geometry.json'), 'utf8'));
  expectedTypes.add(meta.device_type);
  assert.equal(safe.expected_safety_result, 'pass', `${assetId} safe scenario must pass`);
  assert.equal(unsafe.expected_safety_result, 'blocked', `${assetId} unsafe scenario must block`);
  if (assetId === 'generic-industrial-robot-arm') {
    for (const target of ['red_cube', 'pickup_zone', 'right_safe_zone', 'left_safe_zone', 'front_safe_zone', 'back_safe_zone']) {
      assert(meta.constraints.known_targets.includes(target), `${assetId} known_targets must include ${target}`);
      assert(geometry.objects[target] || geometry.zones[target], `${assetId} geometry must declare ${target}`);
    }
  }
}

for (const type of independentTypes) {
  assert(expectedTypes.has(type), `${type} schema coverage missing from built-in assets`);
}

const registrySource = fs.readFileSync(path.join(root, 'lib', 'assets', 'DeviceAssetRegistry.ts'), 'utf8');
for (const assetId of expected) {
  assert(registrySource.includes(assetId), `DeviceAssetRegistry must register ${assetId}`);
}
assert(registrySource.includes('createDefaultDeviceAssetRegistry'), 'DeviceAssetRegistry factory missing');

const importerSource = fs.readFileSync(path.join(root, 'lib', 'assets', 'DeviceAssetImporter.ts'), 'utf8');
const deviceSchemaSource = fs.readFileSync(path.join(root, 'lib', 'schemas', 'deviceMeta.schema.ts'), 'utf8');
for (const fn of ['validateAssetManifest', 'validateLicense', 'validateDeviceMeta', 'validateGeometry', 'validateAdapterManifest', 'createImportedAsset', 'registerImportedAsset']) {
  assert(importerSource.includes(`function ${fn}`), `DeviceAssetImporter missing ${fn}`);
}
assert(importerSource.includes("adapter_type !== 'simulator'") && importerSource.includes('real_device_enabled must remain false'), 'Imported DeviceAssets must remain simulator-only at the authoritative importer.');
assert((deviceSchemaSource.match(/\.strict\(\)/g) ?? []).length >= 15, 'Untrusted device metadata and nested geometry must reject unknown fields instead of stripping them.');
assert(importerSource.includes('license is required'), 'Importer must reject missing license.');
assert(importerSource.includes('source is required'), 'Importer must reject missing source.');

console.log('Asset tests passed.');
console.log(`- ${expected.length} generic industrial assets validated.`);
console.log('- Built-in assets are generic and license-tagged.');
console.log('- Procedural fallback visual models are declared.');
console.log('- DeviceAssetRegistry covers every built-in asset.');
