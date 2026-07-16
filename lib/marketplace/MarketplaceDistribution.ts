import { createHash, createPublicKey } from 'node:crypto';
import { z } from 'zod';
import type { MarketplaceTrustEntry } from './MarketplacePackage';

export interface MarketplaceDistributionConfig {
  schema: 'realitywarden.marketplace-distribution';
  schema_version: 1;
  catalog_url: string | null;
  catalog_key_id: string | null;
  bundled_trust: MarketplaceTrustEntry[];
}

export type MarketplaceDistributionResult =
  | { ok: true; config: MarketplaceDistributionConfig; fingerprints: Array<{ keyId: string; fingerprintSha256: string }> }
  | { ok: false; detail: string };

const trustEntry = z.object({
  keyId: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,79}$/),
  displayName: z.string().min(1).max(120),
  publicKeyPem: z.string().min(80).max(4096),
  trustTier: z.enum(['official', 'verified']),
  revoked: z.boolean()
}).strict();

const distribution = z.object({
  schema: z.literal('realitywarden.marketplace-distribution'),
  schema_version: z.literal(1),
  catalog_url: z.string().url().refine((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, 'catalog_url must use HTTPS').nullable(),
  catalog_key_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,79}$/).nullable(),
  bundled_trust: z.array(trustEntry).max(100)
}).strict();

function inspectPublicKey(publicKeyPem: string): { ok: true; fingerprintSha256: string } | { ok: false; detail: string } {
  if (/PRIVATE KEY/.test(publicKeyPem)) return { ok: false, detail: 'private key material is forbidden in Marketplace distribution config' };
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== 'ed25519') return { ok: false, detail: 'bundled publisher key must be Ed25519' };
    const der = key.export({ type: 'spki', format: 'der' });
    return { ok: true, fingerprintSha256: createHash('sha256').update(der).digest('hex') };
  } catch (error) {
    return { ok: false, detail: `bundled publisher public key is invalid: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function validateMarketplaceDistributionConfig(raw: unknown, options: { productionRequired?: boolean } = {}): MarketplaceDistributionResult {
  const parsed = distribution.safeParse(raw);
  if (!parsed.success) return { ok: false, detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  const ids = new Set<string>();
  const fingerprints = new Set<string>();
  const inspected: Array<{ keyId: string; fingerprintSha256: string }> = [];
  for (const entry of parsed.data.bundled_trust) {
    if (ids.has(entry.keyId)) return { ok: false, detail: `duplicate bundled publisher key id: ${entry.keyId}` };
    ids.add(entry.keyId);
    const key = inspectPublicKey(entry.publicKeyPem);
    if (!key.ok) return { ok: false, detail: `${entry.keyId}: ${key.detail}` };
    if (fingerprints.has(key.fingerprintSha256)) return { ok: false, detail: 'duplicate bundled publisher public key fingerprint' };
    fingerprints.add(key.fingerprintSha256);
    inspected.push({ keyId: entry.keyId, fingerprintSha256: key.fingerprintSha256 });
  }
  if (options.productionRequired) {
    if (!parsed.data.catalog_url) return { ok: false, detail: 'production Marketplace requires an HTTPS catalog_url' };
    if (!parsed.data.catalog_key_id) return { ok: false, detail: 'production Marketplace requires an explicit catalog_key_id' };
    const catalogKey = parsed.data.bundled_trust.find((entry) => entry.keyId === parsed.data.catalog_key_id);
    if (!catalogKey || catalogKey.trustTier !== 'official' || catalogKey.revoked) return { ok: false, detail: 'catalog_key_id must identify a non-revoked bundled official Ed25519 public key' };
  }
  return { ok: true, config: parsed.data, fingerprints: inspected };
}
