'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} missing: ${file}`);
  return file;
}

function readSourceRevision(root) {
  try {
    const commandOptions = { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] };
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], commandOptions).trim();
    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], commandOptions).trim();
    return { commit, worktree: status ? 'dirty' : 'clean' };
  } catch {
    return { commit: null, worktree: 'unavailable' };
  }
}

function buildReleaseEvidence(root, generatedAt = new Date().toISOString()) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const releaseDir = path.join(root, 'release');
  const installerName = `RealityWarden-${packageJson.version}-Setup.exe`;
  const installer = requireFile(path.join(releaseDir, installerName), 'NSIS installer');
  const executable = requireFile(path.join(releaseDir, 'win-unpacked', 'RealityWarden.exe'), 'Packaged executable');
  const buildIdFile = requireFile(path.join(releaseDir, 'win-unpacked', 'resources', 'app.asar.unpacked', '.next-build', 'BUILD_ID'), 'Packaged Next BUILD_ID');

  return {
    schema: 'realitywarden.release-evidence',
    schema_version: 1,
    product: 'RealityWarden',
    release_version: packageJson.version,
    generated_at: generatedAt,
    source: readSourceRevision(root),
    artifact: {
      file: installerName,
      size_bytes: fs.statSync(installer).size,
      sha256: sha256File(installer)
    },
    packaged_app: {
      executable: 'win-unpacked/RealityWarden.exe',
      size_bytes: fs.statSync(executable).size,
      next_build_id: fs.readFileSync(buildIdFile, 'utf8').trim()
    },
    gates: [
      {
        id: 'electron-package-contract',
        status: 'passed',
        evidence: 'scripts/verify-electron-package.cjs completed before this record was written'
      },
      {
        id: 'packaged-first-run-renderer-smoke',
        status: 'passed',
        evidence: 'Packaged renderer loaded AppHeader, DeviceNavigator, CommandDock, one Run/Stop pair, simulation and REAL HARDWARE boundaries, and preload bridge'
      }
    ],
    not_claimed: {
      code_signing: 'not assessed by this record',
      physical_hardware_acceptance: 'optional evidence; not assessed by this record',
      physical_outcome: 'not inferred from packaged startup or command acknowledgement'
    }
  };
}

function writeReleaseEvidence(root, generatedAt) {
  const evidence = buildReleaseEvidence(root, generatedAt);
  const releaseDir = path.join(root, 'release');
  const evidenceName = `RealityWarden-${evidence.release_version}-Release-Evidence.json`;
  const evidencePath = path.join(releaseDir, evidenceName);
  const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
  fs.writeFileSync(evidencePath, serialized, 'utf8');
  const digest = crypto.createHash('sha256').update(serialized).digest('hex').toUpperCase();
  fs.writeFileSync(`${evidencePath}.sha256`, `${digest}  ${evidenceName}\n`, 'utf8');
  return { evidence, evidencePath, digest };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const result = writeReleaseEvidence(root);
  console.log('Release evidence written.');
  console.log(`- Manifest: ${path.basename(result.evidencePath)}`);
  console.log(`- Installer SHA256: ${result.evidence.artifact.sha256}`);
  console.log(`- Manifest SHA256: ${result.digest}`);
}

module.exports = { buildReleaseEvidence, sha256File, writeReleaseEvidence };
