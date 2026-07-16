import { createHash, createPrivateKey, createPublicKey, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
  MAX_MARKETPLACE_CATALOG_ENTRIES,
  MAX_MARKETPLACE_PACKAGE_BYTES,
  signMarketplaceCatalog,
  type MarketplaceCatalog
} from './MarketplaceCatalog';
import { validateMarketplaceDistributionConfig } from './MarketplaceDistribution';
import { verifyMarketplacePackage } from './MarketplacePackage';

export interface MarketplaceCatalogPackageSource {
  packageFile: string;
  bytes: Uint8Array;
}

export type MarketplaceCatalogPublishResult =
  | { ok: true; catalog: MarketplaceCatalog; digestSha256: string; packageCount: number; catalogKeyFingerprintSha256: string }
  | { ok: false; code: string; detail: string };

const buildOrder = z.object({
  schema: z.literal('realitywarden.marketplace-catalog-build-order'),
  schema_version: z.literal(1),
  catalog_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,119}$/),
  generated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  packages: z.array(z.object({
    package_file: z.string().min(1).max(240),
    package_url: z.string().url().refine((value) => {
      try { return new URL(value).protocol === 'https:'; } catch { return false; }
    }, 'package_url must use HTTPS')
  }).strict()).min(1).max(MAX_MARKETPLACE_CATALOG_ENTRIES)
}).strict();

function fail(code: string, detail: string): MarketplaceCatalogPublishResult {
  return { ok: false, code, detail };
}

function publicFingerprint(publicKey: ReturnType<typeof createPublicKey>): string {
  return createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
}

export function publishMarketplaceCatalog(input: {
  rawBuildOrder: unknown;
  rawDistribution: unknown;
  packageSources: readonly MarketplaceCatalogPackageSource[];
  catalogPrivateKeyPem: string;
}): MarketplaceCatalogPublishResult {
  const order = buildOrder.safeParse(input.rawBuildOrder);
  if (!order.success) return fail('build_order_rejected', order.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const distribution = validateMarketplaceDistributionConfig(input.rawDistribution, { productionRequired: true });
  if (!distribution.ok) return fail('distribution_rejected', distribution.detail);
  const catalogKeyId = distribution.config.catalog_key_id;
  const catalogTrust = distribution.config.bundled_trust.find((entry) => entry.keyId === catalogKeyId);
  if (!catalogKeyId || !catalogTrust) return fail('catalog_key_rejected', 'configured Official catalog key is unavailable');

  let catalogKeyFingerprintSha256: string;
  try {
    const privateKey = createPrivateKey(input.catalogPrivateKeyPem);
    if (privateKey.asymmetricKeyType !== 'ed25519') return fail('catalog_key_rejected', 'catalog private key must be Ed25519');
    const derivedPublic = createPublicKey(privateKey);
    const configuredPublic = createPublicKey(catalogTrust.publicKeyPem);
    const derivedDer = Buffer.from(derivedPublic.export({ type: 'spki', format: 'der' }));
    const configuredDer = Buffer.from(configuredPublic.export({ type: 'spki', format: 'der' }));
    if (derivedDer.length !== configuredDer.length || !timingSafeEqual(derivedDer, configuredDer)) {
      return fail('catalog_key_mismatch', 'catalog private key does not match the production distribution Official catalog key');
    }
    catalogKeyFingerprintSha256 = publicFingerprint(derivedPublic);
  } catch (error) {
    return fail('catalog_key_rejected', `catalog private key could not be validated: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (input.packageSources.length !== order.data.packages.length) {
    return fail('package_source_mismatch', 'build order and loaded package source counts differ');
  }
  const sourceNames = new Set<string>();
  const entries = [];
  for (let index = 0; index < order.data.packages.length; index += 1) {
    const requested = order.data.packages[index];
    const source = input.packageSources[index];
    if (source.packageFile !== requested.package_file) return fail('package_source_mismatch', `loaded package source does not match build order at index ${index}`);
    if (sourceNames.has(source.packageFile)) return fail('package_source_rejected', `duplicate package_file: ${source.packageFile}`);
    sourceNames.add(source.packageFile);
    if (source.bytes.byteLength > MAX_MARKETPLACE_PACKAGE_BYTES) return fail('package_too_large', `${source.packageFile} exceeds ${MAX_MARKETPLACE_PACKAGE_BYTES} bytes`);
    let rawPackage: unknown;
    try { rawPackage = JSON.parse(Buffer.from(source.bytes).toString('utf8').replace(/^\uFEFF/, '')) as unknown; }
    catch (error) { return fail('package_json_rejected', `${source.packageFile} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
    const verified = verifyMarketplacePackage(rawPackage, distribution.config.bundled_trust);
    if (!verified.ok) return fail(`package_${verified.code}`, `${source.packageFile}: ${verified.detail}`);
    const pkg = verified.verified.package;
    entries.push({
      package_id: pkg.package_id,
      package_version: pkg.package_version,
      asset_id: pkg.asset.assetId,
      asset_name: pkg.asset.name,
      device_type: pkg.asset.deviceType,
      support_level: pkg.asset.supportLevel,
      package_url: requested.package_url,
      package_file_sha256: createHash('sha256').update(source.bytes).digest('hex'),
      package_digest_sha256: verified.verified.digestSha256
    });
  }

  const signed = signMarketplaceCatalog({
    schema: 'realitywarden.marketplace-catalog',
    schema_version: 1,
    catalog_id: order.data.catalog_id,
    generated_at: order.data.generated_at,
    expires_at: order.data.expires_at,
    publisher: { key_id: catalogKeyId, display_name: catalogTrust.displayName },
    entries
  }, input.catalogPrivateKeyPem);
  if (!signed.ok) return fail(signed.code, signed.detail);
  return { ok: true, catalog: signed.catalog, digestSha256: signed.digestSha256, packageCount: entries.length, catalogKeyFingerprintSha256 };
}
