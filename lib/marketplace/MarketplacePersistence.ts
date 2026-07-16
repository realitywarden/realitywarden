import { z } from 'zod';
import { getBuiltinRealityAssets } from '../reality-assets/assetRegistry';
import { verifyMarketplacePackage, type MarketplaceTrustEntry } from './MarketplacePackage';
import type { MarketplaceAuditEvent, MarketplaceInstallRecord } from './MarketplaceStore';
import { trustCommunityPublisher } from './MarketplaceTrustStore';

export interface MarketplacePersistentState {
  schema: 'realitywarden.marketplace-state';
  schema_version: 1;
  communityTrustEntries: MarketplaceTrustEntry[];
  records: MarketplaceInstallRecord[];
  audit: MarketplaceAuditEvent[];
}

export type MarketplaceRestoreResult =
  | { ok: true; state: MarketplacePersistentState; trustStore: MarketplaceTrustEntry[] }
  | { ok: false; detail: string };

const trustEntrySchema = z.object({
  keyId: z.string().min(3).max(80),
  displayName: z.string().min(1).max(120),
  publicKeyPem: z.string().min(80).max(4096),
  trustTier: z.literal('community'),
  revoked: z.boolean()
}).strict();

const recordSchema = z.object({
  packageId: z.string().min(3).max(120),
  packageVersion: z.string().min(1).max(80),
  assetId: z.string().min(1).max(160),
  digestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  trustTier: z.enum(['official', 'verified', 'community']),
  publisherName: z.string().min(1).max(120),
  state: z.enum(['installed_disabled', 'simulation_enabled']),
  installedAt: z.string().datetime(),
  simulationEnabledAt: z.string().datetime().nullable(),
  package: z.unknown(),
  executionAuthorityGranted: z.literal(false),
  realAdapterEnabled: z.literal(false)
}).strict();

const auditSchema = z.object({
  eventType: z.enum(['install_disabled', 'enable_simulation', 'uninstall']),
  packageId: z.string().min(3).max(120),
  assetId: z.string().min(1).max(160),
  digestSha256: z.string().regex(/^[a-f0-9]{64}$/),
  occurredAt: z.string().datetime(),
  previousState: z.enum(['not_installed', 'installed_disabled', 'simulation_enabled']),
  nextState: z.enum(['not_installed', 'installed_disabled', 'simulation_enabled']),
  hardwareSignalSent: z.literal(false),
  executionAuthorityGranted: z.literal(false)
}).strict();

const stateSchema = z.object({
  schema: z.literal('realitywarden.marketplace-state'),
  schema_version: z.literal(1),
  communityTrustEntries: z.array(trustEntrySchema).max(500),
  records: z.array(recordSchema).max(1000),
  audit: z.array(auditSchema).max(10000)
}).strict();

function fail(detail: string): MarketplaceRestoreResult {
  return { ok: false, detail };
}

export function createEmptyMarketplaceState(): MarketplacePersistentState {
  return {
    schema: 'realitywarden.marketplace-state',
    schema_version: 1,
    communityTrustEntries: [],
    records: [],
    audit: []
  };
}

/**
 * Restores persisted state atomically. No invalid field or record is dropped or
 * repaired: callers must quarantine the whole file and surface the error.
 */
export function restoreMarketplaceState(
  raw: unknown,
  bundledTrustStore: readonly MarketplaceTrustEntry[]
): MarketplaceRestoreResult {
  const parsed = stateSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(`marketplace state schema rejected: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }

  const duplicateBundledId = bundledTrustStore.some((entry, index) =>
    bundledTrustStore.findIndex((candidate) => candidate.keyId === entry.keyId) !== index
  );
  if (duplicateBundledId) return fail('bundled marketplace trust contains duplicate key ids');

  let trustStore = [...bundledTrustStore];
  for (const rawEntry of parsed.data.communityTrustEntries) {
    const imported = trustCommunityPublisher({
      raw: {
        schema: 'realitywarden.community-publisher-key',
        schema_version: 1,
        key_id: rawEntry.keyId,
        display_name: rawEntry.displayName,
        public_key_pem: rawEntry.publicKeyPem
      },
      existingEntries: trustStore,
      confirmed: true
    });
    if (!imported.ok) return fail(`community publisher restore rejected: ${imported.detail}`);
    trustStore = imported.entries.map((entry) => entry === imported.entry ? { ...entry, revoked: rawEntry.revoked } : entry);
  }

  const records = parsed.data.records as MarketplaceInstallRecord[];
  const packageIds = new Set<string>();
  const assetIds = new Set<string>();
  const builtinAssetIds = new Set(getBuiltinRealityAssets().map((asset) => asset.assetId));
  for (const record of records) {
    if (packageIds.has(record.packageId) || assetIds.has(record.assetId)) {
      return fail('marketplace state contains duplicate package or asset identities');
    }
    packageIds.add(record.packageId);
    assetIds.add(record.assetId);
    if (builtinAssetIds.has(record.assetId)) return fail('persisted marketplace state attempts to override a built-in Reality Asset');
    if (
      (record.state === 'installed_disabled' && record.simulationEnabledAt !== null)
      || (record.state === 'simulation_enabled' && record.simulationEnabledAt === null)
    ) return fail(`marketplace record ${record.packageId} has inconsistent enablement timestamps`);

    // A revoked package remains visible for removal/audit, but never for runtime.
    // Temporarily ignore only the revocation bit to authenticate its stored bytes.
    const integrityTrustStore = trustStore.map((entry) => ({ ...entry, revoked: false }));
    const checked = verifyMarketplacePackage(record.package, integrityTrustStore);
    if (!checked.ok) return fail(`stored package ${record.packageId} revalidation failed: ${checked.code}: ${checked.detail}`);
    if (
      checked.verified.digestSha256 !== record.digestSha256
      || checked.verified.trustTier !== record.trustTier
      || checked.verified.trustedPublisherName !== record.publisherName
      || checked.verified.package.package_id !== record.packageId
      || checked.verified.package.package_version !== record.packageVersion
      || checked.verified.package.asset.assetId !== record.assetId
    ) return fail(`stored package ${record.packageId} metadata does not match its signed package`);
  }

  return {
    ok: true,
    state: {
      schema: 'realitywarden.marketplace-state',
      schema_version: 1,
      communityTrustEntries: parsed.data.communityTrustEntries,
      records,
      audit: parsed.data.audit as MarketplaceAuditEvent[]
    },
    trustStore
  };
}

export function serializeMarketplaceState(state: MarketplacePersistentState): string {
  const parsed = stateSchema.safeParse(state);
  if (!parsed.success) {
    throw new Error(`marketplace state schema rejected: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  }
  return `${JSON.stringify(parsed.data, null, 2)}\n`;
}
