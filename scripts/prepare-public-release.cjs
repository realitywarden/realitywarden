'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { validateAuthenticodeEvidence } = require('./windows-authenticode.cjs');

const SHA256 = /^[A-Fa-f0-9]{64}$/;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_LIVE_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function sha256File(filePath) {
  return sha256Bytes(fs.readFileSync(filePath));
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(`${label} contains missing or unknown fields`);
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} missing: ${filePath}`);
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > MAX_EVIDENCE_BYTES) throw new Error(`${label} must be a file no larger than ${MAX_EVIDENCE_BYTES} bytes`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function requireMatchingChecksum(filePath, label) {
  const checksumPath = `${filePath}.sha256`;
  if (!fs.existsSync(checksumPath)) throw new Error(`${label} checksum missing: ${checksumPath}`);
  const fields = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/);
  if (fields.length !== 2 || fields[1] !== path.basename(filePath)) throw new Error(`${label} checksum filename mismatch: ${path.basename(filePath)}`);
  const recorded = fields[0].toUpperCase();
  const actual = sha256File(filePath);
  if (!SHA256.test(recorded) || recorded !== actual) throw new Error(`${label} checksum mismatch: ${path.basename(filePath)}`);
  return actual;
}

function parseIso(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be an ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(`${label} must be a canonical ISO timestamp`);
  return parsed;
}

function validateLiveMarketplaceEvidence(evidence, distribution, now = new Date().toISOString()) {
  exactKeys(evidence, ['schema', 'schema_version', 'checked_at', 'no_redirect', 'no_retry_or_fallback', 'catalogUrl', 'catalogId', 'catalogDigestSha256', 'catalogKeyId', 'catalogPublisherName', 'generatedAt', 'expiresAt', 'packages'], 'Marketplace live evidence');
  if (evidence.schema !== 'realitywarden.marketplace-live-distribution-evidence' || evidence.schema_version !== 1) throw new Error('Invalid Marketplace live evidence schema');
  if (evidence.no_redirect !== true || evidence.no_retry_or_fallback !== true) throw new Error('Marketplace live evidence must prove no redirect, retry, or fallback');
  if (evidence.catalogUrl !== distribution.catalog_url || evidence.catalogKeyId !== distribution.catalog_key_id) throw new Error('Marketplace live evidence does not match the production distribution URL and Official key');
  if (typeof evidence.catalogId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,119}$/.test(evidence.catalogId)) throw new Error('Marketplace live evidence catalog id is invalid');
  if (!SHA256.test(evidence.catalogDigestSha256) || typeof evidence.catalogPublisherName !== 'string' || !evidence.catalogPublisherName.trim()) throw new Error('Marketplace live catalog identity evidence is incomplete');
  const checkedAt = parseIso(evidence.checked_at, 'Marketplace checked_at');
  const generatedAt = parseIso(evidence.generatedAt, 'Marketplace catalog generatedAt');
  const expiresAt = parseIso(evidence.expiresAt, 'Marketplace catalog expiresAt');
  const nowMs = parseIso(now, 'public release clock');
  if (checkedAt < generatedAt || checkedAt >= expiresAt) throw new Error('Marketplace live check was outside the signed catalog validity interval');
  if (checkedAt > nowMs + 5 * 60_000 || nowMs - checkedAt > MAX_LIVE_EVIDENCE_AGE_MS) throw new Error('Marketplace live evidence is stale or implausibly in the future');
  if (nowMs >= expiresAt) throw new Error('Marketplace catalog expired before public release preparation');
  if (!Array.isArray(evidence.packages)) throw new Error('Marketplace live evidence packages must be an array');
  const packageIdentities = new Set();
  const assetIds = new Set();
  const urls = new Set();
  for (const item of evidence.packages) {
    exactKeys(item, ['packageId', 'packageVersion', 'assetId', 'url', 'fileSha256', 'packageDigestSha256', 'trustTier', 'trustedPublisherName'], 'Marketplace live package evidence');
    const identity = `${item.packageId}@${item.packageVersion}`;
    if (packageIdentities.has(identity) || assetIds.has(item.assetId) || urls.has(item.url)) throw new Error('Marketplace live evidence contains duplicate package, asset, or URL identity');
    if (!/^[a-z0-9][a-z0-9._-]{2,119}$/.test(item.packageId) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(item.packageVersion) || !/^[a-z0-9][a-z0-9._-]{2,119}$/.test(item.assetId)) throw new Error('Marketplace live package identity is invalid');
    let parsedUrl;
    try { parsedUrl = new URL(item.url); } catch { throw new Error('Marketplace live package URL is invalid'); }
    if (parsedUrl.protocol !== 'https:' || !SHA256.test(item.fileSha256) || !SHA256.test(item.packageDigestSha256)) throw new Error('Marketplace live package URL or digest is invalid');
    if (!['official', 'verified'].includes(item.trustTier) || typeof item.trustedPublisherName !== 'string' || !item.trustedPublisherName.trim()) throw new Error('Marketplace live package trust evidence is invalid');
    packageIdentities.add(identity);
    assetIds.add(item.assetId);
    urls.add(item.url);
  }
  return evidence;
}

function sourceRevision(root) {
  const options = { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] };
  return {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], options).trim(),
    worktree: execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim() ? 'dirty' : 'clean'
  };
}

function loadDistributionValidator(root) {
  const runtimePath = path.join(root, 'dist-electron-runtime', 'lib', 'marketplace');
  let runtime;
  try { runtime = require(runtimePath); }
  catch (error) { throw new Error(`compiled Marketplace authority unavailable; run desktop:build first: ${error instanceof Error ? error.message : String(error)}`); }
  return (raw) => runtime.validateMarketplaceDistributionConfig(raw, { productionRequired: true });
}

function buildPublicReleaseManifest(root, options = {}) {
  const packageJson = readJson(path.join(root, 'package.json'), 'package metadata');
  const version = packageJson.version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('package version is invalid');
  const releaseDir = path.join(root, 'release');
  const installerName = `RealityWarden-${version}-Setup.exe`;
  const installerPath = path.join(releaseDir, installerName);
  if (!fs.existsSync(installerPath)) throw new Error(`production installer missing: ${installerPath}`);
  const installerSha256 = sha256File(installerPath);
  const releaseEvidenceName = `RealityWarden-${version}-Release-Evidence.json`;
  const releaseEvidencePath = path.join(releaseDir, releaseEvidenceName);
  const releaseEvidenceSha256 = requireMatchingChecksum(releaseEvidencePath, 'release evidence');
  const releaseEvidence = readJson(releaseEvidencePath, 'release evidence');
  if (releaseEvidence.schema !== 'realitywarden.release-evidence' || releaseEvidence.schema_version !== 5 || releaseEvidence.release_version !== version || releaseEvidence.release_mode !== 'production') throw new Error('public release requires schema-v5 production release evidence');
  if (releaseEvidence.artifact?.file !== installerName || releaseEvidence.artifact?.sha256 !== installerSha256 || releaseEvidence.artifact?.size_bytes !== fs.statSync(installerPath).size) throw new Error('production release evidence does not match the exact installer bytes');
  if (releaseEvidence.code_signing?.status !== 'passed' || !Array.isArray(releaseEvidence.gates) || releaseEvidence.gates.some((gate) => gate?.status !== 'passed')) throw new Error('production release evidence contains an unpassed gate');
  const source = options.sourceRevision ?? sourceRevision(root);
  if (source.worktree !== 'clean') throw new Error('public release preparation requires a clean worktree');
  if (releaseEvidence.source?.worktree !== 'clean' || releaseEvidence.source?.commit !== source.commit) throw new Error('production release evidence source does not match the current clean commit');

  const authName = `RealityWarden-${version}-Authenticode-Evidence.json`;
  const authPath = path.join(releaseDir, authName);
  const authSha256 = requireMatchingChecksum(authPath, 'Authenticode evidence');
  const executablePath = path.join(releaseDir, 'win-unpacked', 'RealityWarden.exe');
  const executableSha256 = sha256File(executablePath);
  const auth = validateAuthenticodeEvidence(readJson(authPath, 'Authenticode evidence'), version, {
    'win-unpacked/RealityWarden.exe': executableSha256,
    [installerName]: installerSha256
  });
  const signerThumbprints = new Set(auth.artifacts.map((item) => item.signer.thumbprint));
  if (signerThumbprints.size !== 1) throw new Error('production EXE and installer must share one Authenticode signer identity');

  const rawDistribution = readJson(path.join(root, 'marketplace', 'distribution.json'), 'production Marketplace distribution');
  const validateDistribution = options.validateDistribution ?? loadDistributionValidator(root);
  const distribution = validateDistribution(rawDistribution);
  if (!distribution.ok) throw new Error(`production Marketplace distribution rejected: ${distribution.detail}`);
  const liveName = `RealityWarden-${version}-Marketplace-Live-Evidence.json`;
  const livePath = path.join(releaseDir, liveName);
  const liveSha256 = requireMatchingChecksum(livePath, 'Marketplace live evidence');
  const now = options.now ?? new Date().toISOString();
  const live = validateLiveMarketplaceEvidence(readJson(livePath, 'Marketplace live evidence'), distribution.config, now);

  const referenced = [
    { file: installerName, role: 'windows_installer', sha256: installerSha256, size_bytes: fs.statSync(installerPath).size },
    { file: releaseEvidenceName, role: 'release_evidence', sha256: releaseEvidenceSha256, size_bytes: fs.statSync(releaseEvidencePath).size },
    { file: `${releaseEvidenceName}.sha256`, role: 'release_evidence_checksum' },
    { file: authName, role: 'authenticode_evidence', sha256: authSha256, size_bytes: fs.statSync(authPath).size },
    { file: `${authName}.sha256`, role: 'authenticode_evidence_checksum' },
    { file: liveName, role: 'marketplace_live_evidence', sha256: liveSha256, size_bytes: fs.statSync(livePath).size },
    { file: `${liveName}.sha256`, role: 'marketplace_live_evidence_checksum' }
  ];
  for (const field of ['install_lifecycle', 'product_design_acceptance', 'startup_design_acceptance']) {
    const record = releaseEvidence[field];
    if (!record?.file || !SHA256.test(record.sha256)) throw new Error(`production release evidence is missing ${field}`);
    const evidencePath = path.join(releaseDir, record.file);
    const digest = requireMatchingChecksum(evidencePath, field);
    if (digest !== record.sha256) throw new Error(`${field} digest does not match production release evidence`);
    referenced.push({ file: record.file, role: field, sha256: digest, size_bytes: fs.statSync(evidencePath).size });
    referenced.push({ file: `${record.file}.sha256`, role: `${field}_checksum` });
  }
  for (const item of referenced) {
    const absolute = path.join(releaseDir, item.file);
    if (!fs.existsSync(absolute)) throw new Error(`public release file missing: ${item.file}`);
    if (!item.sha256) item.sha256 = sha256File(absolute);
    if (!item.size_bytes) item.size_bytes = fs.statSync(absolute).size;
  }
  const installerChecksumName = `${installerName}.sha256`;
  const installerChecksumBytes = `${installerSha256}  ${installerName}\n`;
  referenced.push({ file: installerChecksumName, role: 'windows_installer_checksum', sha256: sha256Bytes(installerChecksumBytes), size_bytes: Buffer.byteLength(installerChecksumBytes) });
  return {
    schema: 'realitywarden.public-release-manifest',
    schema_version: 1,
    product: 'RealityWarden',
    release_version: version,
    tag: `v${version}`,
    generated_at: now,
    source: { commit: source.commit, worktree: 'clean' },
    upload_ready: true,
    marketplace: { catalog_url: live.catalogUrl, catalog_key_id: live.catalogKeyId, catalog_digest_sha256: live.catalogDigestSha256, checked_at: live.checked_at, expires_at: live.expiresAt, package_count: live.packages.length },
    authenticode: { signer_thumbprint: [...signerThumbprints][0], artifact_count: auth.artifacts.length },
    files: referenced,
    not_claimed: { industrial_safety_certification: false, general_purpose_hardware_control: false, physical_outcome_verified: false }
  };
}

function writePublicReleaseManifest(root, options = {}) {
  const manifest = buildPublicReleaseManifest(root, options);
  const releaseDir = path.join(root, 'release');
  const installerChecksumName = `RealityWarden-${manifest.release_version}-Setup.exe.sha256`;
  const manifestName = `RealityWarden-${manifest.release_version}-Public-Release-Manifest.json`;
  const outputPaths = [path.join(releaseDir, installerChecksumName), path.join(releaseDir, manifestName), path.join(releaseDir, `${manifestName}.sha256`)];
  if (outputPaths.some((file) => fs.existsSync(file))) throw new Error('public release output already exists; overwrite is refused');
  const installer = manifest.files.find((item) => item.role === 'windows_installer');
  const installerChecksum = `${installer.sha256}  ${installer.file}\n`;
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestChecksum = `${sha256Bytes(serialized)}  ${manifestName}\n`;
  fs.writeFileSync(outputPaths[0], installerChecksum, { encoding: 'utf8', flag: 'wx' });
  fs.writeFileSync(outputPaths[1], serialized, { encoding: 'utf8', flag: 'wx' });
  fs.writeFileSync(outputPaths[2], manifestChecksum, { encoding: 'utf8', flag: 'wx' });
  return { manifest, manifestPath: outputPaths[1], digest: sha256Bytes(serialized) };
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const result = writePublicReleaseManifest(root);
    console.log(`Public release handoff ready for ${result.manifest.tag}.`);
    console.log(`- Manifest: ${path.basename(result.manifestPath)}`);
    console.log(`- Manifest sha256: ${result.digest}`);
    console.log(`- Files bound for upload: ${result.manifest.files.length}`);
  } catch (error) {
    console.error(`Public release preparation refused: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = { buildPublicReleaseManifest, validateLiveMarketplaceEvidence, writePublicReleaseManifest };
