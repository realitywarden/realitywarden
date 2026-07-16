'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateLegalReleaseInputs } = require('./legal-release-inputs.cjs');

const root = path.resolve(__dirname, '..');
const defaultConfigPath = path.join(root, 'marketplace', 'distribution.json');
const runtimePath = path.join(root, 'dist-electron-runtime', 'lib', 'marketplace');

function verifyProductionInputs({ configPath = defaultConfigPath, environment = process.env, validateLegalInputs = validateLegalReleaseInputs } = {}) {
  if (!fs.existsSync(runtimePath)) throw new Error('Compiled Marketplace authority is missing; run npm run desktop:build first.');
  if (!fs.existsSync(configPath)) throw new Error(`Production Marketplace distribution config is missing: ${configPath}`);
  const stat = fs.statSync(configPath);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('Production Marketplace distribution config must be a file no larger than 2 MiB.');

  // The production gate consumes the same compiled authority as Electron. It
  // does not duplicate or weaken publisher-key validation.
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const runtime = require(runtimePath);
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const checked = runtime.validateMarketplaceDistributionConfig(raw, { productionRequired: true });
  if (!checked.ok) throw new Error(`Production Marketplace distribution config rejected: ${checked.detail}`);

  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (packageJson.build?.win?.signAndEditExecutable === false) throw new Error('Windows executable signing is disabled in package.json.');
  if (!(environment.WIN_CSC_LINK || environment.CSC_LINK)) throw new Error('Windows code-signing certificate is missing (set WIN_CSC_LINK or CSC_LINK).');
  const legal = validateLegalInputs(root);

  return {
    catalogUrl: checked.config.catalog_url,
    catalogKeyId: checked.config.catalog_key_id,
    fingerprints: checked.fingerprints,
    legal
  };
}

function selfTest() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'realitywarden-release-gate-'));
  try {
    const { publicKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const valid = {
      schema: 'realitywarden.marketplace-distribution',
      schema_version: 1,
      catalog_url: 'https://catalog.realitywarden.example/v1/catalog.json',
      catalog_key_id: 'official-catalog-v1',
      bundled_trust: [{ keyId: 'official-catalog-v1', displayName: 'RealityWarden Official Catalog', publicKeyPem, trustTier: 'official', revoked: false }]
    };
    const validPath = path.join(directory, 'valid.json');
    fs.writeFileSync(validPath, JSON.stringify(valid), { encoding: 'utf8', flag: 'wx' });
    assert.throws(() => verifyProductionInputs({ configPath: path.join(directory, 'missing.json'), environment: { CSC_LINK: 'fixture' } }), /config is missing/);
    assert.throws(() => verifyProductionInputs({ configPath: validPath, environment: {} }), /code-signing certificate is missing/);
    const legalFixture = () => ({ publisher: { legal_name: 'Fixture Publisher Ltd.' }, sales_jurisdictions: ['GB'] });
    assert.throws(() => verifyProductionInputs({ configPath: validPath, environment: { CSC_LINK: 'fixture' }, validateLegalInputs: () => { throw new Error('Owner-approved legal release manifest is missing'); } }), /legal release manifest is missing/);
    const verified = verifyProductionInputs({ configPath: validPath, environment: { CSC_LINK: 'fixture' }, validateLegalInputs: legalFixture });
    assert.equal(verified.catalogKeyId, 'official-catalog-v1');
    const unprovisionedPath = path.join(directory, 'unprovisioned.json');
    fs.writeFileSync(unprovisionedPath, JSON.stringify({ ...valid, catalog_url: null, catalog_key_id: null, bundled_trust: [] }), { encoding: 'utf8', flag: 'wx' });
    assert.throws(() => verifyProductionInputs({ configPath: unprovisionedPath, environment: { CSC_LINK: 'fixture' }, validateLegalInputs: legalFixture }), /production Marketplace requires/);
    console.log('Production release input gate self-tests passed.');
    console.log('- Missing config, unprovisioned catalog, code-signing certificate, and owner legal inputs fail closed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

if (require.main === module) {
  if (process.argv[2] === '--self-test') selfTest();
  else {
    const verified = verifyProductionInputs();
    console.log(`Production Marketplace config verified for ${verified.catalogUrl}.`);
    console.log(`- Catalog key: ${verified.catalogKeyId}`);
    for (const fingerprint of verified.fingerprints) console.log(`- ${fingerprint.keyId} public-key SHA-256: ${fingerprint.fingerprintSha256}`);
    console.log(`- Owner-approved publisher: ${verified.legal.publisher.legal_name}; sales jurisdictions: ${verified.legal.sales_jurisdictions.join(', ')}`);
    console.log('- Windows code-signing input is present; private signing material was not printed.');
  }
}

module.exports = { verifyProductionInputs };
