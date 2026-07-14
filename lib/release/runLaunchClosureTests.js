const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeReleaseEvidence } = require('../../scripts/write-release-evidence.cjs');

const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const main = read('electron/main.ts');
const pack = read('scripts/pack-electron.cjs');
const page = read('app/page.tsx');
const localRuntime = read('lib/runtime/LocalRuntime.ts');
const projectIpc = read('electron/ipc/project.ipc.ts');
const accessibilityTests = read('lib/ui/runAccessibilityTests.js');
const readiness = read('docs/RELEASE_READINESS_V0.5.0.md');
const desktopDocs = read('docs/DESKTOP_APP.md');

for (const selector of ['AppHeader', 'DeviceNavigator', 'CommandDock', 'data-real-hardware-boundary']) {
  assert(main.includes(selector), `Packaged renderer smoke must verify ${selector}.`);
}
assert(main.includes("runControls === 1") && main.includes("stopControls === 1"), 'Packaged first-run smoke must verify the sole Run/Stop pair.');
assert(main.includes("simulationBoundary") && main.includes("realHardwareBoundary"), 'Packaged first-run smoke must verify distinct simulation and REAL HARDWARE boundaries.');
assert(main.includes("preloadBridge") && main.includes("typeof window.openReality === 'object'"), 'Packaged first-run smoke must verify the preload bridge.');
assert(main.includes('if (isSmokeTest) process.exitCode = 1;'), 'A failed packaged smoke must exit non-zero.');
assert(main.includes("partition: isSmokeTest ? `realitywarden-smoke-${process.pid}`"), 'Packaged first-run smoke must use an isolated ephemeral session.');

const verifyIndex = pack.indexOf('verify-electron-package.cjs');
const smokeIndex = pack.indexOf("['--prod', '--smoke-test']");
const evidenceIndex = pack.indexOf('write-release-evidence.cjs');
assert(verifyIndex >= 0 && verifyIndex < smokeIndex && smokeIndex < evidenceIndex, 'Packaging must verify contents, pass renderer smoke, then write evidence in that order.');

assert(page.includes("llmChip.state === 'offline'") && page.includes('rule compiler (LLM offline)'), 'The UI must visibly label offline LLM degradation.');
assert(localRuntime.includes("audit.info('compiler', 'llm_compiler_fallback'"), 'Offline compiler degradation must remain audited, never silent.');
assert(projectIpc.includes('JSON.stringify(project, null, 2)') && projectIpc.includes('JSON.parse(raw)'), 'Desktop project save/open must preserve a JSON round-trip path.');
assert(accessibilityTests.includes('retry_project_save') && accessibilityTests.includes('retry_project_open') && accessibilityTests.includes('discard_autosave'), 'Launch closure must retain explicit save/open/autosave recovery coverage.');

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-release-evidence-'));
try {
  const fixtureRelease = path.join(fixtureRoot, 'release');
  const fixtureResources = path.join(fixtureRelease, 'win-unpacked', 'resources', 'app.asar.unpacked', '.next-build');
  fs.mkdirSync(fixtureResources, { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify({ version: '9.8.7' }));
  fs.writeFileSync(path.join(fixtureRelease, 'RealityWarden-9.8.7-Setup.exe'), 'installer-fixture');
  fs.writeFileSync(path.join(fixtureRelease, 'win-unpacked', 'RealityWarden.exe'), 'executable-fixture');
  fs.writeFileSync(path.join(fixtureResources, 'BUILD_ID'), 'build-fixture\n');

  const written = writeReleaseEvidence(fixtureRoot, '2026-07-14T00:00:00.000Z');
  const manifest = JSON.parse(fs.readFileSync(written.evidencePath, 'utf8'));
  const expectedInstallerHash = crypto.createHash('sha256').update('installer-fixture').digest('hex').toUpperCase();
  assert.equal(manifest.schema, 'realitywarden.release-evidence');
  assert.equal(manifest.release_version, '9.8.7');
  assert.deepEqual(manifest.source, { commit: null, worktree: 'unavailable' }, 'Evidence must state when source revision cannot be established.');
  assert.equal(manifest.artifact.sha256, expectedInstallerHash, 'Release evidence must hash the exact installer bytes.');
  assert.equal(manifest.packaged_app.next_build_id, 'build-fixture');
  assert.deepEqual(manifest.gates.map((gate) => gate.status), ['passed', 'passed']);
  assert.match(manifest.not_claimed.physical_hardware_acceptance, /not assessed/, 'Release evidence must not invent physical acceptance.');
  const evidenceBytes = fs.readFileSync(written.evidencePath);
  const expectedManifestHash = crypto.createHash('sha256').update(evidenceBytes).digest('hex').toUpperCase();
  assert(fs.readFileSync(`${written.evidencePath}.sha256`, 'utf8').startsWith(expectedManifestHash), 'Evidence companion hash must match the written manifest bytes.');
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

for (const document of [readiness, desktopDocs]) {
  assert(document.includes('Release-Evidence.json'), 'Release documentation must describe the machine-readable evidence manifest.');
  assert(document.includes('first-run renderer smoke'), 'Release documentation must describe the packaged renderer smoke scope honestly.');
}

console.log('Launch closure tests passed.');
console.log('- Packaged smoke verifies the real renderer, preload bridge, sole Run/Stop pair, and both execution boundaries.');
console.log('- Failed smoke exits non-zero; evidence is emitted only after package and renderer verification.');
console.log('- Release evidence records installer/build digests while explicitly excluding physical and signing claims.');
console.log('- Offline degradation, project JSON round-trip, and file recovery remain covered by existing product contracts.');
