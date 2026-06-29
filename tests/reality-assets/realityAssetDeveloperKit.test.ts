import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { buildRealityAssetValidationReport } from '../../lib/reality-assets/validationReport';
import { validateRealityAssetPackage, type RealityAssetPackage } from '../../lib/reality-assets';

function runCli(assetPath: string) {
  try {
    const stdout = execFileSync('node', ['scripts/validate-reality-asset.cjs', assetPath], { encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { code: failure.status ?? 1, stdout: failure.stdout ?? '' };
  }
}

function readAsset(path: string): RealityAssetPackage {
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as RealityAssetPackage;
}

const schema = readFileSync('schemas/reality-asset.schema.json', 'utf8');
assert(schema.includes('"realAdapterEnabled": { "const": false }'), 'Schema must require realAdapterEnabled false.');
assert(schema.includes('"enum": ["simulation_only", "read_only", "coming_soon", "unsupported"]'), 'Schema must include supportLevel enum.');
assert(schema.includes('"enum": ["simulation_only", "read_only", "real_disabled"]'), 'Schema must include adapterMode enum.');

assert(existsSync('docs/REALITY_ASSET_DEVELOPER_KIT.md'), 'Developer kit doc must exist.');

const validRun = runCli('examples/reality-assets/desktop_fan.asset.json');
assert.equal(validRun.code, 0, 'desktop_fan asset must pass CLI validation.');
assert(validRun.stdout.includes('Status: VALID'), 'Valid CLI output must include VALID status.');

const unsafeRun = runCli('examples/reality-assets/unsafe_real_adapter.asset.json');
assert.equal(unsafeRun.code, 1, 'unsafe_real_adapter asset must fail CLI validation.');
assert(unsafeRun.stdout.includes('Status: UNSAFE'), 'Unsafe CLI output must include UNSAFE status.');

const template = readAsset('examples/reality-assets/templates/basic-device.asset.json');
const templateResult = validateRealityAssetPackage(template);
assert.equal(templateResult.valid, true, 'Basic device template must validate.');
assert.equal(template.supportLevel, 'coming_soon', 'Basic device template must remain coming_soon.');
assert.equal(template.adapterBoundary.adapterMode, 'real_disabled', 'Basic device template must stay real_disabled.');

mkdirSync('.tmp-reality-asset-devkit-fixtures', { recursive: true });
const invalidJsonPath = '.tmp-reality-asset-devkit-fixtures/invalid.asset.json';
writeFileSync(invalidJsonPath, '{', 'utf8');
const invalidJsonRun = runCli(invalidJsonPath);
assert.equal(invalidJsonRun.code, 1, 'Invalid JSON must fail CLI validation.');

const missingManifestPath = '.tmp-reality-asset-devkit-fixtures/missing-manifest.asset.json';
const desktopFan = readAsset('examples/reality-assets/desktop_fan.asset.json');
writeFileSync(missingManifestPath, JSON.stringify({ ...desktopFan, deviceManifest: undefined }, null, 2), 'utf8');
const missingManifestRun = runCli(missingManifestPath);
assert.equal(missingManifestRun.code, 1, 'Missing deviceManifest must fail CLI validation.');
assert(missingManifestRun.stdout.includes('add a complete deviceManifest'), 'Missing manifest output must include fix suggestion.');
rmSync('.tmp-reality-asset-devkit-fixtures', { recursive: true, force: true });

const unsafeReport = buildRealityAssetValidationReport(validateRealityAssetPackage(readAsset('examples/reality-assets/unsafe_real_adapter.asset.json')));
assert.equal(unsafeReport.severity, 'unsafe', 'Validation report must mark realAdapterEnabled true as unsafe.');
assert(unsafeReport.fixHints.some((hint) => hint.includes('realAdapterEnabled must be false')), 'Validation report must include realAdapterEnabled fix hint.');
assert(unsafeReport.fixHints.some((hint) => hint.includes('No real execution')), 'Validation report must include no real execution boundary.');

const missingCapabilities = validateRealityAssetPackage({ ...desktopFan, assetId: 'missing_capabilities_fixture', capabilityContracts: [] });
const missingCapabilitiesReport = buildRealityAssetValidationReport(missingCapabilities);
assert(missingCapabilitiesReport.fixHints.some((hint) => hint.includes('capabilityContracts')), 'Validation report must include capabilityContracts fix hint.');

console.log('Reality Asset Developer Kit tests passed.');
