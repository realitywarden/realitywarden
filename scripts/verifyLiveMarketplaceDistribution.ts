import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MAX_MARKETPLACE_PACKAGE_BYTES,
  validateMarketplaceDistributionConfig,
  verifyMarketplaceCatalog,
  verifyMarketplaceDistributionSnapshot
} from '../lib/marketplace';

const MAX_JSON_BYTES = 2 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

function valueAfter(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : null;
}

function readJson(path: string): unknown {
  const stat = statSync(path);
  if (!stat.isFile() || stat.size > MAX_JSON_BYTES) throw new Error(`distribution config must be a JSON file no larger than ${MAX_JSON_BYTES} bytes`);
  return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, '')) as unknown;
}

async function fetchBounded(url: string, maxBytes: number): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error(`Marketplace URL must use HTTPS: ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(parsed, {
      method: 'GET',
      redirect: 'error',
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { accept: 'application/json, application/*+json' },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Marketplace server returned HTTP ${response.status} for ${url}`);
    const length = response.headers.get('content-length');
    if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error(`Marketplace response exceeds ${maxBytes} bytes: ${url}`);
    if (!response.body) throw new Error(`Marketplace response had no body: ${url}`);
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`Marketplace response exceeds ${maxBytes} bytes: ${url}`);
      }
      chunks.push(Buffer.from(chunk.value));
    }
    return Buffer.concat(chunks, total);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Marketplace request timed out; no retry was attempted: ${url}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const distributionArg = valueAfter('--distribution');
  const outputArg = valueAfter('--out');
  if (!distributionArg || !outputArg) {
    console.error('Usage: npm run marketplace:live:verify -- --distribution <production-distribution.json> --out <live-distribution-evidence.json>');
    process.exit(2);
  }
  const outputPath = resolve(outputArg);
  const checksumPath = `${outputPath}.sha256`;
  if (existsSync(outputPath) || existsSync(checksumPath)) throw new Error('evidence output or companion checksum already exists; overwrite is refused');
  const rawDistribution = readJson(resolve(distributionArg));
  const distribution = validateMarketplaceDistributionConfig(rawDistribution, { productionRequired: true });
  if (!distribution.ok) throw new Error(`production distribution rejected: ${distribution.detail}`);
  const checkedAt = new Date().toISOString();
  const catalogBytes = await fetchBounded(distribution.config.catalog_url!, MAX_JSON_BYTES);
  let rawCatalog: unknown;
  try { rawCatalog = JSON.parse(catalogBytes.toString('utf8').replace(/^\uFEFF/, '')) as unknown; }
  catch (error) { throw new Error(`live catalog is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const catalog = verifyMarketplaceCatalog(rawCatalog, distribution.config.bundled_trust, checkedAt);
  if (!catalog.ok) throw new Error(`live catalog rejected: ${catalog.code}: ${catalog.detail}`);
  if (catalog.verified.catalog.publisher.key_id !== distribution.config.catalog_key_id || catalog.verified.trustTier !== 'official') {
    throw new Error('live catalog publisher is not the configured bundled Official catalog key');
  }
  const urls = catalog.verified.catalog.entries.map((entry) => entry.package_url);
  if (new Set(urls).size !== urls.length) throw new Error('live catalog contains duplicate package URLs');
  const packageSnapshots = [];
  for (const url of urls) packageSnapshots.push({ url, bytes: await fetchBounded(url, MAX_MARKETPLACE_PACKAGE_BYTES) });
  const result = verifyMarketplaceDistributionSnapshot({ rawDistribution, rawCatalog, packageSnapshots, now: checkedAt });
  if (!result.ok) throw new Error(`live distribution rejected: ${result.code}: ${result.detail}`);
  const evidence = {
    schema: 'realitywarden.marketplace-live-distribution-evidence',
    schema_version: 1,
    checked_at: checkedAt,
    no_redirect: true,
    no_retry_or_fallback: true,
    ...result.verified
  };
  const evidenceBytes = `${JSON.stringify(evidence, null, 2)}\n`;
  const checksum = createHash('sha256').update(evidenceBytes).digest('hex').toUpperCase();
  writeFileSync(outputPath, evidenceBytes, { encoding: 'utf8', flag: 'wx' });
  writeFileSync(checksumPath, `${checksum}  ${outputPath.split(/[\\/]/).pop()}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`Live Marketplace verified: ${result.verified.catalogId}, ${result.verified.packages.length} package(s)`);
  console.log(`Evidence: ${outputPath}`);
  console.log(`sha256 ${checksum}`);
  console.log('No redirect, retry, or fallback was used.');
}

main().catch((error) => {
  console.error(`Live Marketplace verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
