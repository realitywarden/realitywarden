import { verifyMarketplaceCatalog, verifyMarketplaceCatalogPackage } from './MarketplaceCatalog';
import { validateMarketplaceDistributionConfig } from './MarketplaceDistribution';

export interface MarketplaceDistributionPackageSnapshot {
  url: string;
  bytes: Uint8Array;
}

export interface VerifiedMarketplaceDistributionSnapshot {
  catalogUrl: string;
  catalogId: string;
  catalogDigestSha256: string;
  catalogKeyId: string;
  catalogPublisherName: string;
  generatedAt: string;
  expiresAt: string;
  packages: Array<{
    packageId: string;
    packageVersion: string;
    assetId: string;
    url: string;
    fileSha256: string;
    packageDigestSha256: string;
    trustTier: string;
    trustedPublisherName: string;
  }>;
}

export type MarketplaceDistributionSnapshotResult =
  | { ok: true; verified: VerifiedMarketplaceDistributionSnapshot }
  | { ok: false; code: string; detail: string };

function fail(code: string, detail: string): MarketplaceDistributionSnapshotResult {
  return { ok: false, code, detail };
}

export function verifyMarketplaceDistributionSnapshot(input: {
  rawDistribution: unknown;
  rawCatalog: unknown;
  packageSnapshots: readonly MarketplaceDistributionPackageSnapshot[];
  now?: string;
}): MarketplaceDistributionSnapshotResult {
  const distribution = validateMarketplaceDistributionConfig(input.rawDistribution, { productionRequired: true });
  if (!distribution.ok) return fail('distribution_rejected', distribution.detail);
  const catalog = verifyMarketplaceCatalog(input.rawCatalog, distribution.config.bundled_trust, input.now);
  if (!catalog.ok) return fail(`catalog_${catalog.code}`, catalog.detail);
  if (catalog.verified.catalog.publisher.key_id !== distribution.config.catalog_key_id || catalog.verified.trustTier !== 'official') {
    return fail('catalog_key_mismatch', 'live catalog publisher is not the configured bundled Official catalog key');
  }
  const byUrl = new Map<string, Uint8Array>();
  for (const snapshot of input.packageSnapshots) {
    if (byUrl.has(snapshot.url)) return fail('package_snapshot_rejected', `duplicate downloaded package URL: ${snapshot.url}`);
    byUrl.set(snapshot.url, snapshot.bytes);
  }
  if (byUrl.size !== catalog.verified.catalog.entries.length) {
    return fail('package_snapshot_incomplete', 'downloaded package set must exactly match the live catalog entry count');
  }
  const packages: VerifiedMarketplaceDistributionSnapshot['packages'] = [];
  for (const entry of catalog.verified.catalog.entries) {
    const bytes = byUrl.get(entry.package_url);
    if (!bytes) return fail('package_snapshot_incomplete', `live package bytes are missing for ${entry.package_url}`);
    const checked = verifyMarketplaceCatalogPackage({ entry, bytes, trustStore: distribution.config.bundled_trust });
    if (!checked.ok) return fail(checked.code, `${entry.package_url}: ${checked.detail}`);
    packages.push({
      packageId: checked.package.package_id,
      packageVersion: checked.package.package_version,
      assetId: checked.package.asset.assetId,
      url: entry.package_url,
      fileSha256: checked.fileSha256,
      packageDigestSha256: checked.digestSha256,
      trustTier: checked.trustTier,
      trustedPublisherName: checked.trustedPublisherName
    });
    byUrl.delete(entry.package_url);
  }
  if (byUrl.size !== 0) return fail('package_snapshot_rejected', 'downloaded package set contains URLs absent from the signed catalog');
  return {
    ok: true,
    verified: {
      catalogUrl: distribution.config.catalog_url!,
      catalogId: catalog.verified.catalog.catalog_id,
      catalogDigestSha256: catalog.verified.digestSha256,
      catalogKeyId: catalog.verified.catalog.publisher.key_id,
      catalogPublisherName: catalog.verified.trustedPublisherName,
      generatedAt: catalog.verified.catalog.generated_at,
      expiresAt: catalog.verified.catalog.expires_at,
      packages
    }
  };
}
