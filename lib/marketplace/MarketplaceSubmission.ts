import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  canonicalMarketplaceJson,
  validateMarketplaceDraftAsset
} from './MarketplacePackage';

const packageSourceSchema = z.object({
  kind: z.literal('installed_marketplace_package'),
  package_id: z.string().regex(/^[a-z0-9][a-z0-9._-]{2,119}$/),
  package_version: z.string().min(1).max(80),
  package_digest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  asset_id: z.string().min(1).max(160),
  asset_version: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  publisher_name: z.string().min(1).max(120)
}).strict();

const newAssetSourceSchema = z.object({ kind: z.literal('new_asset') }).strict();
const sourceSchema = z.discriminatedUnion('kind', [packageSourceSchema, newAssetSourceSchema]);

export type MarketplaceSubmissionSource = z.infer<typeof sourceSchema>;

const submissionSchema = z.object({
  schema: z.literal('realitywarden.marketplace-submission-draft'),
  schema_version: z.literal(1),
  created_at: z.string().datetime(),
  source: sourceSchema,
  change_summary: z.string().min(10).max(2000),
  asset_digest_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  asset: z.unknown(),
  review_state: z.literal('local_draft_unsubmitted'),
  signature_present: z.literal(false),
  trust_tier_granted: z.null(),
  execution_authority_granted: z.literal(false),
  real_adapter_enabled: z.literal(false),
  hardwareSignalSent: z.literal(false)
}).strict();

export type MarketplaceSubmissionDraft = z.infer<typeof submissionSchema>;

export type MarketplaceSubmissionResult =
  | { ok: true; draft: MarketplaceSubmissionDraft; digestSha256: string }
  | { ok: false; detail: string };

function semverCore(value: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts as [number, number, number] : null;
}

function isGreaterVersion(next: string, previous: string): boolean {
  const a = semverCore(next);
  const b = semverCore(previous);
  if (!a || !b) return false;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index];
  }
  return false;
}

export function createMarketplaceSubmissionDraft(input: {
  rawAsset: unknown;
  source: MarketplaceSubmissionSource;
  changeSummary: string;
  confirmed: boolean;
  now?: string;
}): MarketplaceSubmissionResult {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit submission-draft export confirmation is required' };
  const source = sourceSchema.safeParse(input.source);
  if (!source.success) return { ok: false, detail: `submission source rejected: ${source.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}` };
  const summary = z.string().min(10).max(2000).safeParse(input.changeSummary.trim());
  if (!summary.success) return { ok: false, detail: 'change summary must contain 10 to 2000 characters' };
  const checked = validateMarketplaceDraftAsset(input.rawAsset);
  if (!checked.ok) return { ok: false, detail: `submission asset rejected: ${checked.detail}` };
  if (source.data.kind === 'installed_marketplace_package') {
    if (checked.asset.assetId !== source.data.asset_id) return { ok: false, detail: 'improved asset id must match its installed source asset id' };
    if (!isGreaterVersion(checked.asset.version, source.data.asset_version)) return { ok: false, detail: 'improved asset version must be greater than the installed source version' };
  }
  const now = input.now ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(now)) || new Date(now).toISOString() !== now) return { ok: false, detail: 'submission timestamp must be an exact ISO timestamp' };
  const asset = JSON.parse(canonicalMarketplaceJson(checked.asset)) as typeof checked.asset;
  const assetDigestSha256 = createHash('sha256').update(canonicalMarketplaceJson(asset)).digest('hex');
  const draft = submissionSchema.parse({
    schema: 'realitywarden.marketplace-submission-draft',
    schema_version: 1,
    created_at: now,
    source: source.data,
    change_summary: summary.data,
    asset_digest_sha256: assetDigestSha256,
    asset,
    review_state: 'local_draft_unsubmitted',
    signature_present: false,
    trust_tier_granted: null,
    execution_authority_granted: false,
    real_adapter_enabled: false,
    hardwareSignalSent: false
  });
  return {
    ok: true,
    draft,
    digestSha256: createHash('sha256').update(canonicalMarketplaceJson(draft)).digest('hex')
  };
}

export function serializeMarketplaceSubmissionDraft(draft: MarketplaceSubmissionDraft): string {
  const parsed = submissionSchema.safeParse(draft);
  if (!parsed.success) throw new Error(`submission draft rejected: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  const checked = createMarketplaceSubmissionDraft({
    rawAsset: parsed.data.asset,
    source: parsed.data.source,
    changeSummary: parsed.data.change_summary,
    confirmed: true,
    now: parsed.data.created_at
  });
  if (!checked.ok || checked.draft.asset_digest_sha256 !== parsed.data.asset_digest_sha256) throw new Error(`submission draft integrity rejected: ${checked.ok ? 'asset digest mismatch' : checked.detail}`);
  return `${JSON.stringify(parsed.data, null, 2)}\n`;
}
