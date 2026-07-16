import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateMarketplaceDistributionConfig } from '../lib/marketplace/MarketplaceDistribution';

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const publicKeyPath = valueAfter('--public-key');
const keyId = valueAfter('--key-id');
const displayName = valueAfter('--display-name');
const trustTier = valueAfter('--tier');
const catalogUrl = valueAfter('--catalog-url');
const outputPath = valueAfter('--out');

if (!publicKeyPath || !keyId || !displayName || !trustTier || !catalogUrl || !outputPath) {
  console.error('Usage: npm run marketplace:provision -- --public-key <ed25519-public.pem> --key-id <id> --display-name <name> --tier <official|verified> --catalog-url <https-url> --out <distribution.json>');
  process.exit(2);
}

try {
  const raw = {
    schema: 'realitywarden.marketplace-distribution',
    schema_version: 1,
    catalog_url: catalogUrl,
    catalog_key_id: keyId,
    bundled_trust: [{
      keyId,
      displayName,
      publicKeyPem: readFileSync(resolve(publicKeyPath), 'utf8'),
      trustTier,
      revoked: false
    }]
  };
  const checked = validateMarketplaceDistributionConfig(raw, { productionRequired: true });
  if (!checked.ok) {
    console.error(`Provisioning refused: ${checked.detail}`);
    process.exit(1);
  }
  writeFileSync(resolve(outputPath), `${JSON.stringify(checked.config, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`Provisioned ${checked.config.bundled_trust.length} public publisher key(s); no private key was read or written.`);
  for (const entry of checked.fingerprints) console.log(`${entry.keyId} sha256 ${entry.fingerprintSha256}`);
} catch (error) {
  console.error(`Provisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
