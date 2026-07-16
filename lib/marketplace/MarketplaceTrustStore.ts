import { createHash, createPublicKey } from 'node:crypto';
import { z } from 'zod';
import type { MarketplaceTrustEntry } from './MarketplacePackage';

const communityPublisherSchema = z.object({
  schema: z.literal('realitywarden.community-publisher-key'),
  schema_version: z.literal(1),
  key_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,79}$/),
  display_name: z.string().min(1).max(120),
  public_key_pem: z.string().min(80).max(4096)
}).strict();

export type CommunityPublisherResult =
  | { ok: true; entries: MarketplaceTrustEntry[]; entry: MarketplaceTrustEntry; fingerprintSha256: string }
  | { ok: false; detail: string };

function inspectEd25519PublicKey(publicKeyPem: string): { ok: true; fingerprint: string } | { ok: false; detail: string } {
  try {
    const key = createPublicKey(publicKeyPem);
    if (key.asymmetricKeyType !== 'ed25519') return { ok: false, detail: 'publisher key must be Ed25519' };
    const der = key.export({ type: 'spki', format: 'der' });
    return { ok: true, fingerprint: createHash('sha256').update(der).digest('hex') };
  } catch (error) {
    return { ok: false, detail: `publisher public key is invalid: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export function trustCommunityPublisher(input: {
  raw: unknown;
  existingEntries: readonly MarketplaceTrustEntry[];
  confirmed: boolean;
}): CommunityPublisherResult {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit community publisher trust confirmation is required' };
  const parsed = communityPublisherSchema.safeParse(input.raw);
  if (!parsed.success) return { ok: false, detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  if (input.existingEntries.some((entry) => entry.keyId === parsed.data.key_id)) {
    return { ok: false, detail: 'publisher key id already exists; replacement is refused' };
  }
  const inspected = inspectEd25519PublicKey(parsed.data.public_key_pem);
  if (!inspected.ok) return { ok: false, detail: inspected.detail };
  const duplicateKey = input.existingEntries.some((entry) => {
    const existing = inspectEd25519PublicKey(entry.publicKeyPem);
    return existing.ok && existing.fingerprint === inspected.fingerprint;
  });
  if (duplicateKey) return { ok: false, detail: 'this publisher public key is already trusted under another identity' };
  const entry: MarketplaceTrustEntry = {
    keyId: parsed.data.key_id,
    displayName: parsed.data.display_name,
    publicKeyPem: parsed.data.public_key_pem,
    trustTier: 'community',
    revoked: false
  };
  return { ok: true, entries: [...input.existingEntries, entry], entry, fingerprintSha256: inspected.fingerprint };
}

export function revokeCommunityPublisher(input: {
  keyId: string;
  existingEntries: readonly MarketplaceTrustEntry[];
  confirmed: boolean;
}): { ok: true; entries: MarketplaceTrustEntry[] } | { ok: false; detail: string } {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit publisher revocation confirmation is required' };
  const entry = input.existingEntries.find((candidate) => candidate.keyId === input.keyId);
  if (!entry) return { ok: false, detail: 'publisher key is not trusted' };
  if (entry.trustTier !== 'community') return { ok: false, detail: 'bundled official/verified trust can only change through a signed app update' };
  if (entry.revoked) return { ok: false, detail: 'publisher key is already revoked' };
  return {
    ok: true,
    entries: input.existingEntries.map((candidate) => candidate === entry ? { ...candidate, revoked: true } : candidate)
  };
}
