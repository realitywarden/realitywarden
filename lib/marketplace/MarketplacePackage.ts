import { createHash, sign, verify } from 'node:crypto';
import { z } from 'zod';
import { validateRealityAssetPackage } from '../reality-assets/assetValidator';
import type { RealityAssetPackage } from '../reality-assets/types';

export type MarketplaceTrustTier = 'official' | 'verified' | 'community';

export interface MarketplaceTrustEntry {
  keyId: string;
  displayName: string;
  publicKeyPem: string;
  trustTier: MarketplaceTrustTier;
  revoked: boolean;
}

export interface MarketplacePackage {
  schema: 'realitywarden.marketplace-package';
  schema_version: 1;
  package_id: string;
  package_version: string;
  published_at: string;
  publisher: {
    key_id: string;
    display_name: string;
  };
  asset: RealityAssetPackage;
  signature: {
    algorithm: 'ed25519';
    value: string;
  };
}

export interface VerifiedMarketplacePackage {
  package: MarketplacePackage;
  digestSha256: string;
  trustTier: MarketplaceTrustTier;
  trustedPublisherName: string;
}

export type MarketplacePackageResult =
  | { ok: true; verified: VerifiedMarketplacePackage }
  | { ok: false; code: string; detail: string };

export type MarketplaceSigningResult =
  | { ok: true; signed: { package: MarketplacePackage; digestSha256: string } }
  | { ok: false; code: string; detail: string };

const publisherSchema = z.object({
  key_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,79}$/),
  display_name: z.string().min(1).max(120)
}).strict();

const signatureSchema = z.object({
  algorithm: z.literal('ed25519'),
  value: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(256)
}).strict();

const envelopeSchema = z.object({
  schema: z.literal('realitywarden.marketplace-package'),
  schema_version: z.literal(1),
  package_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,119}$/),
  package_version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  published_at: z.string().datetime(),
  publisher: publisherSchema,
  asset: z.unknown(),
  signature: signatureSchema
}).strict();

const unsignedEnvelopeSchema = envelopeSchema.omit({ signature: true });

const forbiddenDeclarativeKeys = new Set([
  '__proto__', 'prototype', 'constructor',
  'code', 'script', 'scripts', 'shell', 'command', 'commands',
  'postinstall', 'preinstall', 'runtimehook', 'runtime_hook',
  'endpoint', 'endpointurl', 'deviceendpointurl', 'webhook',
  'apikey', 'api_key', 'token', 'credential', 'credentials'
]);

const realityAssetTopLevelKeys = new Set([
  'assetId', 'name', 'version', 'vendor', 'description', 'deviceType',
  'deviceManifest', 'capabilityContracts', 'worldModelAssumptions',
  'adapterBoundary', 'examplePrompts', 'validationRules', 'supportLevel',
  'safetyNotes', 'tags'
]);

function failure(code: string, detail: string): { ok: false; code: string; detail: string } {
  return { ok: false, code, detail };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validatedMarketplaceAsset(raw: unknown):
  | { ok: true; asset: RealityAssetPackage }
  | { ok: false; detail: string } {
  if (!isPlainRecord(raw)) return { ok: false, detail: 'asset must be a JSON object' };
  const unexpected = Object.keys(raw).filter((key) => !realityAssetTopLevelKeys.has(key));
  if (unexpected.length > 0) return { ok: false, detail: `asset contains unknown top-level fields: ${unexpected.join(', ')}` };
  if (!isPlainRecord(raw.adapterBoundary)) return { ok: false, detail: 'asset.adapterBoundary must be an object' };
  if (!isPlainRecord(raw.deviceManifest) || !isPlainRecord(raw.deviceManifest.adapter)) {
    return { ok: false, detail: 'asset.deviceManifest and its adapter boundary must be objects' };
  }
  try {
    const asset = raw as unknown as RealityAssetPackage;
    const validation = validateRealityAssetPackage(asset);
    if (!validation.valid) return { ok: false, detail: validation.errors.join('; ') };
    if (asset.adapterBoundary.realAdapterEnabled !== false || asset.deviceManifest.adapter.realAdapterEnabled !== false) {
      return { ok: false, detail: 'marketplace packages can never enable a real adapter' };
    }
    return { ok: true, asset };
  } catch (error) {
    return { ok: false, detail: `asset validation failed closed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function assertDeclarativeJson(value: unknown, path = '$', seen = new Set<object>()): string | null {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} contains a non-finite number`;
  if (Array.isArray(value)) {
    if (seen.has(value)) return `${path} contains a cycle`;
    seen.add(value);
    for (let index = 0; index < value.length; index += 1) {
      const issue = assertDeclarativeJson(value[index], `${path}[${index}]`, seen);
      if (issue) return issue;
    }
    seen.delete(value);
    return null;
  }
  if (!isPlainRecord(value)) return `${path} must contain JSON data only`;
  if (seen.has(value)) return `${path} contains a cycle`;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenDeclarativeKeys.has(key.toLowerCase())) return `${path}.${key} is forbidden executable or secret-bearing metadata`;
    const issue = assertDeclarativeJson(child, `${path}.${key}`, seen);
    if (issue) return issue;
  }
  seen.delete(value);
  return null;
}

/** Deterministic JSON for signatures. Rejects values JSON would silently lose. */
export function canonicalMarketplaceJson(value: unknown): string {
  const issue = assertDeclarativeJson(value);
  if (issue) throw new Error(issue);
  if (Array.isArray(value)) return `[${value.map(canonicalMarketplaceJson).join(',')}]`;
  if (isPlainRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalMarketplaceJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function marketplaceSigningPayload(pkg: Omit<MarketplacePackage, 'signature'> | MarketplacePackage) {
  const { signature: _signature, ...unsigned } = pkg as MarketplacePackage;
  return Buffer.from(canonicalMarketplaceJson(unsigned), 'utf8');
}

export function signMarketplacePackage(
  rawDraft: unknown,
  privateKeyPem: string
): MarketplaceSigningResult {
  const parsed = unsignedEnvelopeSchema.safeParse(rawDraft);
  if (!parsed.success) {
    return failure('draft_schema_rejected', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  }
  const declarativeIssue = assertDeclarativeJson(parsed.data.asset, '$.asset');
  if (declarativeIssue) return failure('non_declarative_content', declarativeIssue);
  const assetCheck = validatedMarketplaceAsset(parsed.data.asset);
  if (!assetCheck.ok) return failure('asset_rejected', assetCheck.detail);
  try {
    const unsigned = JSON.parse(canonicalMarketplaceJson(parsed.data)) as Omit<MarketplacePackage, 'signature'>;
    const signature = sign(null, marketplaceSigningPayload(unsigned), privateKeyPem).toString('base64');
    return {
      ok: true,
      signed: {
        package: { ...unsigned, signature: { algorithm: 'ed25519', value: signature } },
        digestSha256: createHash('sha256').update(marketplaceSigningPayload(unsigned)).digest('hex')
      }
    };
  } catch (error) {
    return failure('signing_key_rejected', `Ed25519 signing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function verifyMarketplacePackage(
  raw: unknown,
  trustStore: readonly MarketplaceTrustEntry[]
): MarketplacePackageResult {
  const parsed = envelopeSchema.safeParse(raw);
  if (!parsed.success) {
    return failure('schema_rejected', parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  }
  const declarativeIssue = assertDeclarativeJson(parsed.data.asset, '$.asset');
  if (declarativeIssue) return failure('non_declarative_content', declarativeIssue);

  const matchingKeys = trustStore.filter((entry) => entry.keyId === parsed.data.publisher.key_id);
  if (matchingKeys.length !== 1) return failure('publisher_untrusted', 'publisher key is absent or ambiguous in the local trust store');
  const trust = matchingKeys[0];
  if (trust.revoked) return failure('publisher_revoked', 'publisher key is revoked');
  if (parsed.data.publisher.display_name !== trust.displayName) {
    return failure('publisher_identity_mismatch', 'package publisher name does not match the trusted key record');
  }

  let signatureBytes: Buffer;
  try {
    signatureBytes = Buffer.from(parsed.data.signature.value, 'base64');
    if (signatureBytes.length !== 64 || signatureBytes.toString('base64') !== parsed.data.signature.value) {
      return failure('signature_rejected', 'signature must be canonical base64 Ed25519 data');
    }
  } catch {
    return failure('signature_rejected', 'signature is not valid base64');
  }
  let validSignature = false;
  try {
    validSignature = verify(null, marketplaceSigningPayload(parsed.data as MarketplacePackage), trust.publicKeyPem, signatureBytes);
  } catch (error) {
    return failure('trust_key_rejected', `trusted public key could not verify Ed25519 data: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!validSignature) return failure('signature_mismatch', 'package content does not match its publisher signature');

  const assetCheck = validatedMarketplaceAsset(parsed.data.asset);
  if (!assetCheck.ok) return failure('asset_rejected', assetCheck.detail);

  const normalized = JSON.parse(canonicalMarketplaceJson(parsed.data)) as MarketplacePackage;
  return {
    ok: true,
    verified: {
      package: normalized,
      digestSha256: createHash('sha256').update(marketplaceSigningPayload(normalized)).digest('hex'),
      trustTier: trust.trustTier,
      trustedPublisherName: trust.displayName
    }
  };
}
