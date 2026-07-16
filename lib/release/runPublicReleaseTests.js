'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildPublicReleaseManifest, writePublicReleaseManifest } = require('../../scripts/prepare-public-release.cjs');

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

function writeChecksummed(directory, name, value) {
  const bytes = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(directory, name), bytes, 'utf8');
  fs.writeFileSync(path.join(directory, `${name}.sha256`), `${digest(bytes)}  ${name}\n`, 'utf8');
  return digest(bytes);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-public-release-'));
try {
  const release = path.join(root, 'release');
  const marketplace = path.join(root, 'marketplace');
  fs.mkdirSync(path.join(release, 'win-unpacked'), { recursive: true });
  fs.mkdirSync(marketplace, { recursive: true });
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.8.7' }));
  const installerName = 'RealityWarden-9.8.7-Setup.exe';
  const installerBytes = 'installer-fixture';
  const executableBytes = 'executable-fixture';
  fs.writeFileSync(path.join(release, installerName), installerBytes);
  fs.writeFileSync(path.join(release, 'win-unpacked', 'RealityWarden.exe'), executableBytes);
  const installerSha256 = digest(installerBytes);
  const executableSha256 = digest(executableBytes);
  const linked = [
    ['RealityWarden-9.8.7-Install-Lifecycle.json', 'lifecycle-fixture'],
    ['RealityWarden-9.8.7-Design-Acceptance.json', 'design-fixture'],
    ['RealityWarden-9.8.7-Startup-Acceptance.json', 'startup-fixture']
  ];
  const linkedDigests = Object.fromEntries(linked.map(([name, bytes]) => [name, writeChecksummed(release, name, bytes)]));
  const releaseEvidenceName = 'RealityWarden-9.8.7-Release-Evidence.json';
  const baseReleaseEvidence = {
    schema: 'realitywarden.release-evidence', schema_version: 5, release_version: '9.8.7', release_mode: 'production',
    source: { commit: 'a'.repeat(40), worktree: 'clean' },
    artifact: { file: installerName, size_bytes: Buffer.byteLength(installerBytes), sha256: installerSha256 },
    code_signing: { status: 'passed' },
    gates: [{ id: 'package', status: 'passed' }, { id: 'windows-authenticode', status: 'passed' }],
    install_lifecycle: { file: linked[0][0], sha256: linkedDigests[linked[0][0]] },
    product_design_acceptance: { file: linked[1][0], sha256: linkedDigests[linked[1][0]] },
    startup_design_acceptance: { file: linked[2][0], sha256: linkedDigests[linked[2][0]] }
  };
  writeChecksummed(release, releaseEvidenceName, baseReleaseEvidence);
  const authName = 'RealityWarden-9.8.7-Authenticode-Evidence.json';
  const signer = { subject: 'CN=Fixture Publisher', thumbprint: 'A'.repeat(40) };
  const timestamp = { subject: 'CN=Fixture TSA', thumbprint: 'B'.repeat(40) };
  const baseAuth = {
    schema: 'realitywarden.windows-authenticode-evidence', schema_version: 1, release_version: '9.8.7',
    artifacts: [
      { file: 'win-unpacked/RealityWarden.exe', sha256: executableSha256, status: 'Valid', signer, timestamp },
      { file: installerName, sha256: installerSha256, status: 'Valid', signer, timestamp }
    ]
  };
  writeChecksummed(release, authName, baseAuth);
  const distribution = { catalog_url: 'https://catalog.example/v1/catalog.json', catalog_key_id: 'official-catalog-v1' };
  fs.writeFileSync(path.join(marketplace, 'distribution.json'), JSON.stringify(distribution));
  const liveName = 'RealityWarden-9.8.7-Marketplace-Live-Evidence.json';
  const baseLive = {
    schema: 'realitywarden.marketplace-live-distribution-evidence', schema_version: 1,
    checked_at: '2026-07-16T11:00:00.000Z', no_redirect: true, no_retry_or_fallback: true,
    catalogUrl: distribution.catalog_url, catalogId: 'realitywarden.production.v1', catalogDigestSha256: 'c'.repeat(64),
    catalogKeyId: distribution.catalog_key_id, catalogPublisherName: 'RealityWarden Official Catalog',
    generatedAt: '2026-07-16T10:00:00.000Z', expiresAt: '2026-08-16T10:00:00.000Z',
    packages: [{
      packageId: 'fixture.device', packageVersion: '1.0.0', assetId: 'fixture_asset',
      url: 'https://catalog.example/v1/packages/fixture.device-1.0.0.json', fileSha256: 'd'.repeat(64),
      packageDigestSha256: 'e'.repeat(64), trustTier: 'official', trustedPublisherName: 'RealityWarden Review Board'
    }]
  };
  writeChecksummed(release, liveName, baseLive);
  const options = {
    now: '2026-07-16T12:00:00.000Z',
    sourceRevision: { commit: 'a'.repeat(40), worktree: 'clean' },
    validateDistribution: (raw) => ({ ok: true, config: raw })
  };
  const valid = buildPublicReleaseManifest(root, options);
  assert.equal(valid.upload_ready, true);
  assert.equal(valid.tag, 'v9.8.7');
  assert.equal(valid.marketplace.package_count, 1);
  assert.equal(valid.files.length, 14, 'public handoff must enumerate installer plus every required evidence file and checksum');

  assert.throws(() => buildPublicReleaseManifest(root, { ...options, sourceRevision: { commit: 'a'.repeat(40), worktree: 'dirty' } }), /clean worktree/, 'dirty current source must be refused');
  writeChecksummed(release, releaseEvidenceName, { ...baseReleaseEvidence, release_mode: 'internal_acceptance' });
  assert.throws(() => buildPublicReleaseManifest(root, options), /schema-v5 production/, 'internal acceptance evidence must never become a public release handoff');
  writeChecksummed(release, releaseEvidenceName, baseReleaseEvidence);

  writeChecksummed(release, liveName, { ...baseLive, checked_at: '2026-07-15T10:00:00.000Z', generatedAt: '2026-07-01T10:00:00.000Z' });
  assert.throws(() => buildPublicReleaseManifest(root, options), /stale/, 'stale live Marketplace evidence must be refused');
  writeChecksummed(release, liveName, { ...baseLive, catalogKeyId: 'different-official-key' });
  assert.throws(() => buildPublicReleaseManifest(root, options), /does not match/, 'live evidence for a different Official key must be refused');
  writeChecksummed(release, liveName, { ...baseLive, unexpected: true });
  assert.throws(() => buildPublicReleaseManifest(root, options), /unknown fields/, 'unknown live evidence fields must be refused');
  writeChecksummed(release, liveName, baseLive);
  fs.writeFileSync(path.join(release, `${liveName}.sha256`), `${digest(`${JSON.stringify(baseLive, null, 2)}\n`)}  wrong-live-evidence.json\n`, 'utf8');
  assert.throws(() => buildPublicReleaseManifest(root, options), /checksum filename mismatch/, 'a checksum companion naming different bytes must be refused');
  writeChecksummed(release, liveName, baseLive);

  writeChecksummed(release, authName, { ...baseAuth, artifacts: baseAuth.artifacts.map((item, index) => index === 0 ? { ...item, status: 'NotSigned' } : item) });
  assert.throws(() => buildPublicReleaseManifest(root, options), /not Valid/, 'forged NotSigned Authenticode evidence must be refused even with a matching checksum');
  writeChecksummed(release, authName, baseAuth);

  fs.appendFileSync(path.join(release, installerName), '-tampered');
  assert.throws(() => buildPublicReleaseManifest(root, options), /exact installer bytes/, 'post-evidence installer tampering must be refused');
  fs.writeFileSync(path.join(release, installerName), installerBytes);

  const written = writePublicReleaseManifest(root, options);
  assert.equal(written.manifest.upload_ready, true);
  assert(fs.existsSync(path.join(release, 'RealityWarden-9.8.7-Setup.exe.sha256')));
  assert(fs.existsSync(`${written.manifestPath}.sha256`));
  assert.throws(() => writePublicReleaseManifest(root, options), /overwrite is refused/, 'public release outputs must never be overwritten');
  console.log('Public release handoff tests passed (10 cases).');
  console.log('- Production evidence, exact artifacts, clean source, live Marketplace, and one Authenticode identity are bound into one upload manifest.');
  console.log('- Dirty, stale, internal, forged, tampered, mismatched, unknown-field, and overwrite cases fail closed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
