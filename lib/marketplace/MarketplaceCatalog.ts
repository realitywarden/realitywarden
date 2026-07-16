import { createHash, sign, verify } from 'node:crypto';
import { z } from 'zod';
import { canonicalMarketplaceJson, verifyMarketplacePackage, type MarketplacePackage, type MarketplaceTrustEntry, type MarketplaceTrustTier } from './MarketplacePackage';

export const MAX_MARKETPLACE_CATALOG_ENTRIES = 5_000;
export const MAX_MARKETPLACE_PACKAGE_BYTES = 2 * 1024 * 1024;

export interface MarketplaceCatalogEntry {
  package_id: string;
  package_version: string;
  asset_id: string;
  asset_name: string;
  device_type: string;
  support_level: 'simulation_only' | 'read_only';
  package_url: string;
  package_file_sha256: string;
  package_digest_sha256: string;
}

export interface MarketplaceCatalog {
  schema: 'realitywarden.marketplace-catalog';
  schema_version: 1;
  catalog_id: string;
  generated_at: string;
  expires_at: string;
  publisher: { key_id: string; display_name: string };
  entries: MarketplaceCatalogEntry[];
  signature: { algorithm: 'ed25519'; value: string };
}

export interface VerifiedMarketplaceCatalog {
  catalog: MarketplaceCatalog;
  digestSha256: string;
  trustTier: MarketplaceTrustTier;
  trustedPublisherName: string;
}

export type MarketplaceCatalogResult =
  | { ok: true; verified: VerifiedMarketplaceCatalog }
  | { ok: false; code: string; detail: string };

export type MarketplaceCatalogPackageResult =
  | { ok: true; package: MarketplacePackage; digestSha256: string; fileSha256: string; trustTier: MarketplaceTrustTier; trustedPublisherName: string }
  | { ok: false; code: string; detail: string };

const id = z.string().regex(/^[a-z0-9][a-z0-9._-]{2,119}$/);
const version = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const publisher = z.object({
  key_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,79}$/),
  display_name: z.string().min(1).max(120)
}).strict();
const signature = z.object({
  algorithm: z.literal('ed25519'),
  value: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(256)
}).strict();
const catalogEntry = z.object({
  package_id: id,
  package_version: version,
  asset_id: id,
  asset_name: z.string().min(1).max(200),
  device_type: z.string().min(1).max(120),
  support_level: z.enum(['simulation_only', 'read_only']),
  package_url: z.string().url().refine((value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }, 'package_url must use HTTPS'),
  package_file_sha256: sha256,
  package_digest_sha256: sha256
}).strict();
const catalogEnvelope = z.object({
  schema: z.literal('realitywarden.marketplace-catalog'),
  schema_version: z.literal(1),
  catalog_id: id,
  generated_at: z.string().datetime(),
  expires_at: z.string().datetime(),
  publisher,
  entries: z.array(catalogEntry).max(MAX_MARKETPLACE_CATALOG_ENTRIES),
  signature
}).strict();
const unsignedCatalogEnvelope = catalogEnvelope.omit({ signature: true });

function fail(code: string, detail: string): { ok: false; code: string; detail: string } {
  return { ok: false, code, detail };
}

function canonicalSignatureBytes(value: string): Buffer | null {
  try {
    const bytes = Buffer.from(value, 'base64');
    return bytes.length === 64 && bytes.toString('base64') === value ? bytes : null;
  } catch {
    return null;
  }
}

function catalogPayload(catalog: Omit<MarketplaceCatalog, 'signature'> | MarketplaceCatalog): Buffer {
  const { signature: _signature, ...unsigned } = catalog as MarketplaceCatalog;
  return Buffer.from(canonicalMarketplaceJson(unsigned), 'utf8');
}

function entryIdentityIssue(entries: readonly MarketplaceCatalogEntry[]): string | null {
  const packages = new Set<string>();
  const assets = new Set<string>();
  for (const entry of entries) {
    const packageIdentity = `${entry.package_id}@${entry.package_version}`;
    if (packages.has(packageIdentity)) return `duplicate catalog package identity: ${packageIdentity}`;
    if (assets.has(entry.asset_id)) return `duplicate catalog asset identity: ${entry.asset_id}`;
    packages.add(packageIdentity);
    assets.add(entry.asset_id);
  }
  return null;
}

export function marketplaceCatalogSigningPayload(catalog: Omit<MarketplaceCatalog, 'signature'> | MarketplaceCatalog): Buffer {
  return catalogPayload(catalog);
}

export function signMarketplaceCatalog(rawDraft: unknown, privateKeyPem: string):
  | { ok: true; catalog: MarketplaceCatalog; digestSha256: string }
  | { ok: false; code: string; detail: string } {
  const parsed = unsignedCatalogEnvelope.safeParse(rawDraft);
  if (!parsed.success) return fail('draft_schema_rejected', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const identityIssue = entryIdentityIssue(parsed.data.entries);
  if (identityIssue) return fail('catalog_identity_rejected', identityIssue);
  if (Date.parse(parsed.data.expires_at) <= Date.parse(parsed.data.generated_at)) return fail('catalog_time_rejected', 'expires_at must be after generated_at');
  try {
    const normalized = JSON.parse(canonicalMarketplaceJson(parsed.data)) as Omit<MarketplaceCatalog, 'signature'>;
    const value = sign(null, catalogPayload(normalized), privateKeyPem).toString('base64');
    const catalog: MarketplaceCatalog = { ...normalized, signature: { algorithm: 'ed25519', value } };
    return { ok: true, catalog, digestSha256: createHash('sha256').update(catalogPayload(catalog)).digest('hex') };
  } catch (error) {
    return fail('signing_key_rejected', `Ed25519 catalog signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function verifyMarketplaceCatalog(
  raw: unknown,
  trustStore: readonly MarketplaceTrustEntry[],
  now = new Date().toISOString()
): MarketplaceCatalogResult {
  const parsed = catalogEnvelope.safeParse(raw);
  if (!parsed.success) return fail('schema_rejected', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const identityIssue = entryIdentityIssue(parsed.data.entries);
  if (identityIssue) return fail('catalog_identity_rejected', identityIssue);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) return fail('clock_rejected', 'catalog verification clock must be an ISO timestamp');
  const generatedMs = Date.parse(parsed.data.generated_at);
  const expiresMs = Date.parse(parsed.data.expires_at);
  if (expiresMs <= generatedMs) return fail('catalog_time_rejected', 'expires_at must be after generated_at');
  if (generatedMs > nowMs + 5 * 60_000) return fail('catalog_not_yet_valid', 'catalog generated_at is implausibly in the future');
  if (nowMs >= expiresMs) return fail('catalog_expired', 'catalog has expired; stale listings are not shown as current');

  const matching = trustStore.filter((entry) => entry.keyId === parsed.data.publisher.key_id);
  if (matching.length !== 1) return fail('publisher_untrusted', 'catalog publisher key is absent or ambiguous in the local trust store');
  const trust = matching[0];
  if (trust.revoked) return fail('publisher_revoked', 'catalog publisher key is revoked');
  if (trust.displayName !== parsed.data.publisher.display_name) return fail('publisher_identity_mismatch', 'catalog publisher name does not match the trusted key record');
  const signatureBytes = canonicalSignatureBytes(parsed.data.signature.value);
  if (!signatureBytes) return fail('signature_rejected', 'catalog signature must be canonical base64 Ed25519 data');
  let valid = false;
  try { valid = verify(null, catalogPayload(parsed.data as MarketplaceCatalog), trust.publicKeyPem, signatureBytes); }
  catch (error) { return fail('trust_key_rejected', `trusted catalog key could not verify Ed25519 data: ${error instanceof Error ? error.message : String(error)}`); }
  if (!valid) return fail('signature_mismatch', 'catalog content does not match its publisher signature');
  const normalized = JSON.parse(canonicalMarketplaceJson(parsed.data)) as MarketplaceCatalog;
  return {
    ok: true,
    verified: {
      catalog: normalized,
      digestSha256: createHash('sha256').update(catalogPayload(normalized)).digest('hex'),
      trustTier: trust.trustTier,
      trustedPublisherName: trust.displayName
    }
  };
}

export function verifyMarketplaceCatalogPackage(input: {
  entry: MarketplaceCatalogEntry;
  bytes: Uint8Array;
  trustStore: readonly MarketplaceTrustEntry[];
}): MarketplaceCatalogPackageResult {
  if (input.bytes.byteLength > MAX_MARKETPLACE_PACKAGE_BYTES) return fail('package_too_large', `package exceeds ${MAX_MARKETPLACE_PACKAGE_BYTES} bytes`);
  const fileSha256 = createHash('sha256').update(input.bytes).digest('hex');
  if (fileSha256 !== input.entry.package_file_sha256) return fail('package_file_digest_mismatch', 'downloaded package bytes do not match the signed catalog sha256');
  let raw: unknown;
  try { raw = JSON.parse(Buffer.from(input.bytes).toString('utf8').replace(/^\uFEFF/, '')) as unknown; }
  catch (error) { return fail('package_json_rejected', `downloaded package is not valid JSON: ${error instanceof Error ? error.message : String(error)}`); }
  const checked = verifyMarketplacePackage(raw, input.trustStore);
  if (!checked.ok) return fail(`package_${checked.code}`, checked.detail);
  const pkg = checked.verified.package;
  if (
    pkg.package_id !== input.entry.package_id
    || pkg.package_version !== input.entry.package_version
    || pkg.asset.assetId !== input.entry.asset_id
    || pkg.asset.name !== input.entry.asset_name
    || pkg.asset.deviceType !== input.entry.device_type
    || pkg.asset.supportLevel !== input.entry.support_level
    || checked.verified.digestSha256 !== input.entry.package_digest_sha256
  ) return fail('package_catalog_metadata_mismatch', 'downloaded signed package metadata does not exactly match its signed catalog entry');
  return {
    ok: true,
    package: pkg,
    digestSha256: checked.verified.digestSha256,
    fileSha256,
    trustTier: checked.verified.trustTier,
    trustedPublisherName: checked.verified.trustedPublisherName
  };
}
