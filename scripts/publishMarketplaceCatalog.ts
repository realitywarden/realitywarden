import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { MAX_MARKETPLACE_PACKAGE_BYTES, publishMarketplaceCatalog } from '../lib/marketplace';

const MAX_CONTROL_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PRIVATE_KEY_BYTES = 16 * 1024;

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

function readBounded(path: string, maxBytes: number, label: string): Buffer {
  const size = statSync(path).size;
  if (size > maxBytes) throw new Error(`${label} exceeds ${maxBytes} bytes`);
  return readFileSync(path);
}

function packagePath(orderDirectory: string, requested: string): string {
  if (isAbsolute(requested)) throw new Error(`package_file must be relative to the build order: ${requested}`);
  const resolved = resolve(orderDirectory, requested);
  const realOrderDirectory = realpathSync(orderDirectory);
  const realPackagePath = realpathSync(resolved);
  const within = relative(realOrderDirectory, realPackagePath);
  if (!within || within.startsWith('..') || isAbsolute(within)) throw new Error(`package_file escapes or aliases the build-order directory: ${requested}`);
  return realPackagePath;
}

const orderArg = valueAfter('--order');
const distributionArg = valueAfter('--distribution');
const privateKeyArg = valueAfter('--private-key');
const outputArg = valueAfter('--out');

if (!orderArg || !distributionArg || !privateKeyArg || !outputArg) {
  console.error('Usage: npm run marketplace:catalog:publish -- --order <catalog-build-order.json> --distribution <production-distribution.json> --private-key <official-catalog-private.pem> --out <catalog.json>');
  process.exit(2);
}

try {
  const orderPath = resolve(orderArg);
  const orderDirectory = dirname(orderPath);
  const rawBuildOrder = JSON.parse(readBounded(orderPath, MAX_CONTROL_FILE_BYTES, 'catalog build order').toString('utf8').replace(/^\uFEFF/, '')) as unknown;
  const rawDistribution = JSON.parse(readBounded(resolve(distributionArg), MAX_CONTROL_FILE_BYTES, 'Marketplace distribution config').toString('utf8').replace(/^\uFEFF/, '')) as unknown;
  const catalogPrivateKeyPem = readBounded(resolve(privateKeyArg), MAX_PRIVATE_KEY_BYTES, 'catalog private key').toString('utf8');
  const packageRequests = Array.isArray((rawBuildOrder as { packages?: unknown }).packages)
    ? (rawBuildOrder as { packages: Array<{ package_file?: unknown }> }).packages
    : [];
  const packageSources = packageRequests.map((request) => {
    if (typeof request.package_file !== 'string') throw new Error('every package_file must be a string');
    return {
      packageFile: request.package_file,
      bytes: readBounded(packagePath(orderDirectory, request.package_file), MAX_MARKETPLACE_PACKAGE_BYTES, `package ${request.package_file}`)
    };
  });
  const result = publishMarketplaceCatalog({ rawBuildOrder, rawDistribution, packageSources, catalogPrivateKeyPem });
  if (!result.ok) {
    console.error(`Catalog publication refused: ${result.code}: ${result.detail}`);
    process.exit(1);
  }
  writeFileSync(resolve(outputArg), `${JSON.stringify(result.catalog, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`Published ${result.catalog.catalog_id} with ${result.packageCount} verified package(s)`);
  console.log(`catalog sha256 ${result.digestSha256}`);
  console.log(`catalog key fingerprint sha256 ${result.catalogKeyFingerprintSha256}`);
  console.log('All entry metadata and digests were derived from exact verified package bytes. Private key material was not written.');
} catch (error) {
  console.error(`Catalog publication failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
