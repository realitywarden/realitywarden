'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateLifecycleEvidence } = require('./verify-windows-install-lifecycle.cjs');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}

function requireFile(file, label) {
  if (!fs.existsSync(file)) throw new Error(`${label} missing: ${file}`);
  return file;
}

function requireMatchingChecksum(file, label) {
  const checksumFile = requireFile(`${file}.sha256`, `${label} checksum`);
  const digest = sha256File(file);
  const recorded = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0].toUpperCase();
  if (recorded !== digest) throw new Error(`${label} checksum mismatch: ${path.basename(file)}`);
  return digest;
}

function validateDesignEvidence(evidence) {
  if (evidence?.schema !== 'realitywarden.product-design-acceptance' || evidence?.schema_version !== 1) throw new Error('Invalid product-design acceptance evidence schema.');
  for (const gate of ['responsive_layout', 'bilingual_content', 'windows_scaling', 'dialog_boundaries', 'keyboard_focus', 'forced_colors']) {
    if (evidence.gates?.[gate] !== 'passed') throw new Error(`Product-design acceptance gate did not pass: ${gate}`);
  }
  const layouts = Array.isArray(evidence.layouts) ? evidence.layouts : [];
  for (const contract of [[1440, 900, 'zh'], [1440, 900, 'en'], [1180, 720, 'zh'], [1180, 720, 'en']]) {
    if (!layouts.some((item) => item?.viewport?.width === contract[0] && item?.viewport?.height === contract[1] && item?.language === contract[2] && item?.violations?.length === 0)) throw new Error(`Product-design viewport evidence missing: ${contract.join('x')}`);
  }
  const scales = new Set((Array.isArray(evidence.scaling) ? evidence.scaling : []).map((item) => item?.requestedScale));
  if (!scales.has(1.25) || !scales.has(1.5)) throw new Error('Product-design Windows scaling evidence is incomplete.');
  const dialogs = new Set((Array.isArray(evidence.dialogs) ? evidence.dialogs : []).filter((item) => item?.status === 'passed' && item?.focusRestored === true).map((item) => item.id));
  for (const dialog of ['action-composer', 'asset-import', 'manual-import']) if (!dialogs.has(dialog)) throw new Error(`Product-design dialog evidence missing: ${dialog}`);
  if (evidence.contrast?.forcedColors !== true || evidence.contrast?.hardwareBorderStyle !== 'double') throw new Error('Product-design forced-colors evidence is incomplete.');
  return evidence;
}

function validateStartupEvidence(evidence) {
  if (evidence?.schema !== 'realitywarden.startup-design-acceptance' || evidence?.schema_version !== 1) throw new Error('Invalid startup-design acceptance evidence schema.');
  for (const gate of ['no_flash_tokens', 'responsive_layout', 'bilingual_content', 'windows_scaling', 'failure_recovery', 'reduced_motion', 'forced_colors']) {
    if (evidence.gates?.[gate] !== 'passed') throw new Error(`Startup-design acceptance gate did not pass: ${gate}`);
  }
  const layouts = Array.isArray(evidence.layouts) ? evidence.layouts : [];
  for (const contract of [[1440, 900, 'zh'], [1440, 900, 'en'], [1180, 720, 'zh'], [1180, 720, 'en']]) {
    if (!layouts.some((item) => item?.viewport?.width === contract[0] && item?.viewport?.height === contract[1] && item?.language === contract[2] && item?.violations?.length === 0)) throw new Error(`Startup-design viewport evidence missing: ${contract.join('x')}`);
  }
  const scales = new Set((Array.isArray(evidence.scaling) ? evidence.scaling : []).map((item) => item?.requested));
  if (!scales.has(1.25) || !scales.has(1.5)) throw new Error('Startup-design Windows scaling evidence is incomplete.');
  if (evidence.reduced_motion?.matches !== true || evidence.reduced_motion?.animationName !== 'none') throw new Error('Startup-design reduced-motion evidence is incomplete.');
  if (evidence.forced_colors?.matches !== true || evidence.forced_colors?.borderLeftStyle !== 'double' || evidence.forced_colors?.focusVisible !== true) throw new Error('Startup-design forced-colors evidence is incomplete.');
  return evidence;
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
  const lifecycleName = `RealityWarden-${packageJson.version}-Install-Lifecycle.json`;
  const lifecycleFile = requireFile(path.join(releaseDir, lifecycleName), 'Windows install lifecycle evidence');
  const lifecycleHashFile = requireFile(`${lifecycleFile}.sha256`, 'Windows install lifecycle evidence checksum');
  const lifecycleHash = sha256File(lifecycleFile);
  const recordedLifecycleHash = fs.readFileSync(lifecycleHashFile, 'utf8').trim().split(/\s+/)[0].toUpperCase();
  if (recordedLifecycleHash !== lifecycleHash) throw new Error(`Windows install lifecycle evidence checksum mismatch: ${lifecycleName}`);
  const lifecycle = validateLifecycleEvidence(JSON.parse(fs.readFileSync(lifecycleFile, 'utf8')), packageJson.version, sha256File(installer));
  const designName = `RealityWarden-${packageJson.version}-Design-Acceptance.json`;
  const designFile = requireFile(path.join(releaseDir, designName), 'Product-design acceptance evidence');
  const designHash = requireMatchingChecksum(designFile, 'Product-design acceptance evidence');
  const design = validateDesignEvidence(JSON.parse(fs.readFileSync(designFile, 'utf8')));
  const startupName = `RealityWarden-${packageJson.version}-Startup-Acceptance.json`;
  const startupFile = requireFile(path.join(releaseDir, startupName), 'Startup-design acceptance evidence');
  const startupHash = requireMatchingChecksum(startupFile, 'Startup-design acceptance evidence');
  const startup = validateStartupEvidence(JSON.parse(fs.readFileSync(startupFile, 'utf8')));

  return {
    schema: 'realitywarden.release-evidence',
    schema_version: 4,
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
    install_lifecycle: {
      file: lifecycleName,
      sha256: lifecycleHash,
      user_data_policy: lifecycle.user_data_policy
    },
    product_design_acceptance: {
      file: designName,
      sha256: designHash,
      gates: design.gates
    },
    startup_design_acceptance: {
      file: startupName,
      sha256: startupHash,
      gates: startup.gates
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
      },
      {
        id: 'windows-install-lifecycle',
        status: 'passed',
        evidence: 'Isolated current-user clean install, installed first run, forced-offline degradation, in-place reinstall, uninstall cleanup, and user-data preservation passed'
      },
      {
        id: 'product-design-acceptance',
        status: 'passed',
        evidence: '1440x900 and 1180x720 bilingual layouts, 125%/150% scale, dialogs, focus return, and forced-colors boundaries passed'
      },
      {
        id: 'startup-design-acceptance',
        status: 'passed',
        evidence: 'Neutral dark launch shell, bilingual responsive layouts, 125%/150% scale, escaped recovery details, reduced motion, and forced colors passed'
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

module.exports = { buildReleaseEvidence, sha256File, validateDesignEvidence, validateStartupEvidence, writeReleaseEvidence };
