import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signMarketplacePackage } from '../lib/marketplace/MarketplacePackage';

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

const draftPath = valueAfter('--draft');
const privateKeyPath = valueAfter('--private-key');
const outputPath = valueAfter('--out');

if (!draftPath || !privateKeyPath || !outputPath) {
  console.error('Usage: npm run marketplace:sign -- --draft <reviewed.json> --private-key <ed25519-private.pem> --out <package.json>');
  process.exit(2);
}

try {
  const draft = JSON.parse(readFileSync(resolve(draftPath), 'utf8').replace(/^\uFEFF/, '')) as unknown;
  const privateKey = readFileSync(resolve(privateKeyPath), 'utf8');
  const result = signMarketplacePackage(draft, privateKey);
  if (!result.ok) {
    console.error(`Signing refused: ${result.code}: ${result.detail}`);
    process.exit(1);
  }
  writeFileSync(resolve(outputPath), `${JSON.stringify(result.signed.package, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`Signed ${result.signed.package.package_id}@${result.signed.package.package_version}`);
  console.log(`sha256 ${result.signed.digestSha256}`);
  console.log('Trust tier is not embedded; consumers derive it from their local trust store.');
} catch (error) {
  console.error(`Signing failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
