'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildSupplyChainArtifacts, validateSupplyChainEvidence, writeSupplyChainEvidence } = require('../../scripts/write-supply-chain-evidence.cjs');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-supply-chain-'));
try {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'open-reality-interface', version: '9.8.7' }));
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: {} }));
  const zeroCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 };
  const audit = { metadata: { vulnerabilities: zeroCounts, dependencies: { total: 42 } }, vulnerabilities: {} };
  const sbom = {
    bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: 'urn:uuid:fixture',
    metadata: { component: { type: 'application', name: 'open-reality-interface', version: '9.8.7' } },
    components: [{ type: 'library', name: 'fixture', version: '1.0.0', 'bom-ref': 'fixture@1.0.0' }],
    dependencies: [{ ref: 'open-reality-interface@9.8.7', dependsOn: ['fixture@1.0.0'] }]
  };
  const runner = (args) => args[0] === 'audit'
    ? { status: 0, stdout: JSON.stringify(audit), stderr: '' }
    : { status: 0, stdout: JSON.stringify(sbom), stderr: '' };
  const generatedAt = '2026-07-16T12:00:00.000Z';
  const built = buildSupplyChainArtifacts(root, { runNpm: runner, generatedAt });
  assert.equal(built.evidence.audit.vulnerabilities.total, 0);
  assert.equal(built.evidence.sbom.component_count, 1);
  const lockSha256 = sha256(fs.readFileSync(path.join(root, 'package-lock.json')));
  assert.doesNotThrow(() => validateSupplyChainEvidence(built.evidence, {
    version: '9.8.7', packageLockSha256: lockSha256, sbomFile: built.evidence.sbom.file,
    sbomSha256: sha256(built.sbomBytes), now: '2026-07-16T13:00:00.000Z'
  }));

  const vulnerableAudit = { ...audit, metadata: { ...audit.metadata, vulnerabilities: { ...zeroCounts, high: 1, total: 1 } } };
  assert.throws(() => buildSupplyChainArtifacts(root, {
    runNpm: (args) => args[0] === 'audit' ? { status: 1, stdout: JSON.stringify(vulnerableAudit), stderr: '' } : runner(args), generatedAt
  }), /found 1 known vulnerability/, 'known vulnerabilities must fail closed even when npm returns parseable JSON');
  assert.throws(() => buildSupplyChainArtifacts(root, {
    runNpm: (args) => args[0] === 'audit' ? runner(args) : { status: 0, stdout: JSON.stringify({ ...sbom, metadata: { component: { ...sbom.metadata.component, version: 'different' } } }), stderr: '' }, generatedAt
  }), /does not match package metadata/, 'an SBOM for a different root package must be refused');
  assert.throws(() => validateSupplyChainEvidence(built.evidence, {
    version: '9.8.7', packageLockSha256: 'F'.repeat(64), sbomFile: built.evidence.sbom.file,
    sbomSha256: sha256(built.sbomBytes), now: '2026-07-16T13:00:00.000Z'
  }), /does not match the current package-lock/, 'lockfile changes after audit must invalidate the evidence');
  assert.throws(() => validateSupplyChainEvidence(built.evidence, {
    version: '9.8.7', packageLockSha256: lockSha256, sbomFile: built.evidence.sbom.file,
    sbomSha256: sha256(built.sbomBytes), now: '2026-07-18T13:00:00.000Z'
  }), /stale/, 'stale supply-chain evidence must not enter a public release');
  const written = writeSupplyChainEvidence(root, { runNpm: runner, generatedAt });
  assert(fs.existsSync(written.sbomPath));
  assert(fs.existsSync(`${written.evidencePath}.sha256`));
  assert.throws(() => writeSupplyChainEvidence(root, { runNpm: runner, generatedAt }), /overwrite is refused/, 'supply-chain evidence outputs must never be overwritten');
  console.log('Supply-chain release evidence tests passed (6 cases).');
  console.log('- Lockfile-bound CycloneDX inventory and a fresh zero-vulnerability npm audit are required.');
  console.log('- Vulnerable, divergent, stale, and overwrite cases fail closed without fallback.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
