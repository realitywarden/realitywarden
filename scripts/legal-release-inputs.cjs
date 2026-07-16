'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
const MIN_DOCUMENT_BYTES = 256;
const FIXED_DOCUMENTS = {
  eula: 'PRODUCT_EULA.txt',
  privacy_notice: 'PRIVACY_NOTICE.txt'
};

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex').toLowerCase();
}

function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw new Error(`${label} contains missing or unknown fields`);
}

function canonicalTimestamp(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a canonical ISO timestamp`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw new Error(`${label} must be a canonical ISO timestamp`);
  if (parsed > Date.now() + 5 * 60_000) throw new Error(`${label} cannot be in the future`);
  return value;
}

function readBoundedFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} missing: ${filePath}`);
  const stat = fs.lstatSync(filePath);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size < MIN_DOCUMENT_BYTES || stat.size > MAX_DOCUMENT_BYTES) throw new Error(`${label} must be a non-symlink file between ${MIN_DOCUMENT_BYTES} and ${MAX_DOCUMENT_BYTES} bytes`);
  const bytes = fs.readFileSync(filePath);
  if (bytes.includes(0)) throw new Error(`${label} must be UTF-8 text without NUL bytes`);
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  if (text.includes('\uFFFD')) throw new Error(`${label} is not valid UTF-8 text`);
  if (/\b(?:TODO|TBD|FIXME)\b|\[\s*insert\b|<\s*insert\b|lorem ipsum/i.test(text)) throw new Error(`${label} contains placeholder text`);
  return { bytes, text, sha256: sha256(bytes), sizeBytes: bytes.byteLength };
}

function validateLegalReleaseInputs(root, options = {}) {
  const inputRoot = path.resolve(options.inputRoot ?? path.join(root, 'release-inputs', 'legal'));
  const expectedRoot = path.resolve(root);
  if (!inputRoot.startsWith(`${expectedRoot}${path.sep}`) && options.allowExternalRoot !== true) throw new Error('legal release input root must stay inside the repository');
  const manifestPath = path.join(inputRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Owner-approved legal release manifest is missing: ${manifestPath}`);
  const manifestStat = fs.lstatSync(manifestPath);
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error('Legal release manifest must be a non-symlink file');
  const manifestBytes = fs.readFileSync(manifestPath);
  if (manifestBytes.byteLength > 128 * 1024) throw new Error('Legal release manifest must be no larger than 128 KiB');
  const manifest = JSON.parse(manifestBytes.toString('utf8').replace(/^\uFEFF/, ''));
  exactKeys(manifest, ['schema', 'schema_version', 'product', 'release_version', 'approval_scope', 'approved_at', 'approved_by', 'approval_reference', 'publisher', 'sales_jurisdictions', 'documents'], 'Legal release manifest');
  if (manifest.schema !== 'realitywarden.legal-release-inputs' || manifest.schema_version !== 1) throw new Error('Invalid legal release input schema');
  if (manifest.product !== 'RealityWarden') throw new Error('Legal release inputs must name RealityWarden');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const expectedVersion = options.expectedVersion ?? packageJson.version;
  if (manifest.release_version !== expectedVersion) throw new Error(`Legal release input version mismatch: expected ${expectedVersion}`);
  if (manifest.approval_scope !== 'production_release') throw new Error('Legal release approval scope must be production_release');
  canonicalTimestamp(manifest.approved_at, 'Legal approval timestamp');
  for (const [value, label] of [[manifest.approved_by, 'approved_by'], [manifest.approval_reference, 'approval_reference']]) {
    if (typeof value !== 'string' || value.trim().length < 3 || value.length > 200) throw new Error(`Legal release ${label} is invalid`);
  }
  exactKeys(manifest.publisher, ['legal_name', 'jurisdiction', 'support_email', 'privacy_email'], 'Legal publisher');
  if (typeof manifest.publisher.legal_name !== 'string' || manifest.publisher.legal_name.trim().length < 2 || manifest.publisher.legal_name.length > 200) throw new Error('Publisher legal name is invalid');
  if (typeof manifest.publisher.jurisdiction !== 'string' || manifest.publisher.jurisdiction.trim().length < 2 || manifest.publisher.jurisdiction.length > 120) throw new Error('Publisher jurisdiction is invalid');
  for (const field of ['support_email', 'privacy_email']) {
    if (typeof manifest.publisher[field] !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manifest.publisher[field])) throw new Error(`Publisher ${field} is invalid`);
  }
  if (!Array.isArray(manifest.sales_jurisdictions) || manifest.sales_jurisdictions.length === 0 || manifest.sales_jurisdictions.length > 64) throw new Error('At least one sales jurisdiction is required');
  const jurisdictions = manifest.sales_jurisdictions.map((value) => {
    if (typeof value !== 'string' || !/^[A-Z]{2}$/.test(value)) throw new Error('Sales jurisdictions must use ISO 3166-1 alpha-2 codes');
    return value;
  });
  if (new Set(jurisdictions).size !== jurisdictions.length) throw new Error('Sales jurisdictions must be unique');
  exactKeys(manifest.documents, Object.keys(FIXED_DOCUMENTS), 'Legal documents');
  const documents = {};
  for (const [id, fixedName] of Object.entries(FIXED_DOCUMENTS)) {
    const record = manifest.documents[id];
    exactKeys(record, ['file', 'sha256'], `Legal document ${id}`);
    if (record.file !== fixedName) throw new Error(`Legal document ${id} must use fixed file name ${fixedName}`);
    if (typeof record.sha256 !== 'string' || !SHA256.test(record.sha256)) throw new Error(`Legal document ${id} sha256 is invalid`);
    const filePath = path.join(inputRoot, fixedName);
    const checked = readBoundedFile(filePath, `Legal document ${id}`);
    if (checked.sha256 !== record.sha256) throw new Error(`Legal document ${id} sha256 mismatch`);
    if (!checked.text.includes('RealityWarden')) throw new Error(`Legal document ${id} must identify RealityWarden`);
    if (!checked.text.includes(manifest.publisher.legal_name)) throw new Error(`Legal document ${id} must identify the publisher legal name`);
    documents[id] = { file: fixedName, path: filePath, sha256: checked.sha256, size_bytes: checked.sizeBytes };
  }
  return {
    input_root: inputRoot,
    manifest_path: manifestPath,
    manifest_sha256: sha256(manifestBytes),
    release_version: manifest.release_version,
    approved_at: manifest.approved_at,
    approved_by: manifest.approved_by,
    approval_reference: manifest.approval_reference,
    publisher: manifest.publisher,
    sales_jurisdictions: jurisdictions,
    documents
  };
}

function writeFixture(inputRoot, overrides = {}) {
  fs.mkdirSync(inputRoot, { recursive: true });
  const publisher = { legal_name: 'Fixture Robotics Ltd.', jurisdiction: 'England and Wales', support_email: 'support@fixture.invalid', privacy_email: 'privacy@fixture.invalid' };
  const eula = `RealityWarden End User License Agreement\nPublisher: ${publisher.legal_name}\n${'Owner-approved fixture terms for validation only. '.repeat(8)}\n`;
  const privacy = `RealityWarden Privacy Notice\nPublisher: ${publisher.legal_name}\n${'Owner-approved fixture privacy disclosure for validation only. '.repeat(8)}\n`;
  fs.writeFileSync(path.join(inputRoot, FIXED_DOCUMENTS.eula), eula);
  fs.writeFileSync(path.join(inputRoot, FIXED_DOCUMENTS.privacy_notice), privacy);
  const manifest = {
    schema: 'realitywarden.legal-release-inputs', schema_version: 1, product: 'RealityWarden', release_version: '9.8.7', approval_scope: 'production_release',
    approved_at: '2026-07-16T00:00:00.000Z', approved_by: 'Fixture Owner', approval_reference: 'fixture-legal-review-1', publisher,
    sales_jurisdictions: ['GB'], documents: {
      eula: { file: FIXED_DOCUMENTS.eula, sha256: sha256(Buffer.from(eula)) },
      privacy_notice: { file: FIXED_DOCUMENTS.privacy_notice, sha256: sha256(Buffer.from(privacy)) }
    }, ...overrides
  };
  fs.writeFileSync(path.join(inputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-legal-inputs-'));
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '9.8.7' }));
    const inputRoot = path.join(root, 'release-inputs', 'legal');
    writeFixture(inputRoot);
    const valid = validateLegalReleaseInputs(root);
    assert.equal(valid.publisher.legal_name, 'Fixture Robotics Ltd.');
    assert.equal(valid.documents.eula.file, 'PRODUCT_EULA.txt');
    fs.appendFileSync(path.join(inputRoot, 'PRODUCT_EULA.txt'), 'tamper');
    assert.throws(() => validateLegalReleaseInputs(root), /sha256 mismatch/);
    writeFixture(inputRoot, { release_version: '9.8.6' });
    assert.throws(() => validateLegalReleaseInputs(root), /version mismatch/);
    writeFixture(inputRoot);
    fs.writeFileSync(path.join(inputRoot, 'PRIVACY_NOTICE.txt'), `RealityWarden ${valid.publisher.legal_name} TODO ${'padding '.repeat(40)}`);
    const badBytes = fs.readFileSync(path.join(inputRoot, 'PRIVACY_NOTICE.txt'));
    const manifest = JSON.parse(fs.readFileSync(path.join(inputRoot, 'manifest.json')));
    manifest.documents.privacy_notice.sha256 = sha256(badBytes);
    fs.writeFileSync(path.join(inputRoot, 'manifest.json'), JSON.stringify(manifest));
    assert.throws(() => validateLegalReleaseInputs(root), /placeholder text/);
    writeFixture(inputRoot);
    const unknown = JSON.parse(fs.readFileSync(path.join(inputRoot, 'manifest.json')));
    unknown.unexpected = true;
    fs.writeFileSync(path.join(inputRoot, 'manifest.json'), JSON.stringify(unknown));
    assert.throws(() => validateLegalReleaseInputs(root), /unknown fields/);
    fs.rmSync(path.join(inputRoot, 'manifest.json'));
    assert.throws(() => validateLegalReleaseInputs(root), /manifest is missing/);
    console.log('Owner legal release input tests passed (6 cases).');
    console.log('- Missing, stale-version, placeholder, and digest-mismatched legal inputs fail closed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else {
    try {
      const root = path.resolve(__dirname, '..');
      const checked = validateLegalReleaseInputs(root);
      console.log(`Owner-approved legal release inputs verified for RealityWarden ${checked.release_version}.`);
      console.log(`- Publisher: ${checked.publisher.legal_name}`);
      console.log(`- Sales jurisdictions: ${checked.sales_jurisdictions.join(', ')}`);
      console.log('- EULA and privacy notice digests match; legal adequacy is not inferred by this software check.');
    } catch (error) {
      console.error(`Legal release input verification refused: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
}

module.exports = { validateLegalReleaseInputs };
