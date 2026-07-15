/**
 * Governed firmware write orders — the "compile & write" stage of controlled
 * device onboarding.
 *
 * A write order is the only reviewed contract under which the flash tool will
 * write a firmware image for an onboarding draft. It pairs a validated
 * FirmwareConfigurationDraft with exactly one reviewed prebuilt image and an
 * explicit, separate human write authorization.
 *
 * Invariants (only ever tightened here):
 * - No draft, no order. The embedded draft is revalidated on every read.
 * - Templates without a reviewed prebuilt image are refused outright; the
 *   tool never compiles ad-hoc firmware or guesses an image.
 * - A write order grants ZERO execution authority. Flashing a board does not
 *   touch the runtime evidence lock, the actuation ticket path, or
 *   `real_adapter_enabled`. Those fields are literal `false` in the schema,
 *   so stored-record tampering is rejected, not honoured.
 */
import { z } from 'zod';
import {
  firmwareConfigurationDraftSchema,
  validateFirmwareConfigurationDraft,
  type FirmwareConfigurationDraft
} from './FirmwareConfiguration';

/**
 * The only images a write order may reference. `null` means the template is
 * accepted at the draft stage but has no reviewed image yet — writing must be
 * refused honestly instead of substituting a "close enough" binary.
 */
export const PREBUILT_FIRMWARE_IMAGES: Record<
  FirmwareConfigurationDraft['firmware_template_id'],
  { file: string } | null
> = {
  esp32_s3_sg90_hc_sr04_v1: { file: 'firmware/prebuilt/esp32s3-realitywarden-v0.1.4.merged.bin' },
  esp32_s3_digital_output_v1: null,
  esp32_s3_hc_sr04_read_only_v1: null
};

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const firmwareWriteOrderSchema = z.object({
  schema: z.literal('realitywarden.firmware-write-order'),
  schema_version: z.literal(1),
  status: z.literal('write_authorized'),
  draft: firmwareConfigurationDraftSchema,
  image: z.object({
    file: z.string().min(1).max(260),
    sha256: sha256Schema
  }).strict(),
  write_review: z.object({
    confirmed: z.literal(true),
    confirmed_at: z.string().datetime(),
    operator: z.string().min(1).max(120)
  }).strict(),
  /** Flashing never grants runtime execution authority. Literal false. */
  execution_authority_granted: z.literal(false),
  /** Flashing never enables a real adapter. Literal false. */
  real_adapter_enabled: z.literal(false)
}).strict();

export type FirmwareWriteOrder = z.infer<typeof firmwareWriteOrderSchema>;
export type FirmwareWriteOrderResult =
  | { ok: true; order: FirmwareWriteOrder }
  | { ok: false; detail: string };

export function createFirmwareWriteOrder(input: {
  draft: unknown;
  operator: string;
  write_review_confirmed: boolean;
  /** sha256 of the image file, computed by the caller from disk. */
  image_sha256: string;
}, now = new Date().toISOString()): FirmwareWriteOrderResult {
  const draftCheck = validateFirmwareConfigurationDraft(input.draft);
  if (!draftCheck.ok) return { ok: false, detail: `draft rejected: ${draftCheck.detail}` };
  if (input.write_review_confirmed !== true) {
    return { ok: false, detail: 'explicit write authorization review is required (separate from the draft review)' };
  }
  const operator = typeof input.operator === 'string' ? input.operator.trim() : '';
  if (operator.length === 0 || operator.length > 120) {
    return { ok: false, detail: 'write authorization requires a named operator' };
  }
  const registered = PREBUILT_FIRMWARE_IMAGES[draftCheck.draft.firmware_template_id];
  if (!registered) {
    return {
      ok: false,
      detail: `no reviewed prebuilt image exists for template ${draftCheck.draft.firmware_template_id}; writing is refused instead of guessed`
    };
  }
  const shaCheck = sha256Schema.safeParse(input.image_sha256);
  if (!shaCheck.success) return { ok: false, detail: 'image_sha256 must be a lowercase hex sha256 digest' };

  const order = firmwareWriteOrderSchema.parse({
    schema: 'realitywarden.firmware-write-order',
    schema_version: 1,
    status: 'write_authorized',
    draft: draftCheck.draft,
    image: { file: registered.file, sha256: shaCheck.data },
    write_review: { confirmed: true, confirmed_at: now, operator },
    execution_authority_granted: false,
    real_adapter_enabled: false
  });
  return { ok: true, order };
}

/**
 * Validate a stored write order. `actual` carries what the flash tool
 * observed on disk; any mismatch is a refusal, never a warning.
 */
export function validateFirmwareWriteOrder(
  raw: unknown,
  actual?: { image_file?: string; image_sha256?: string }
): FirmwareWriteOrderResult {
  const parsed = firmwareWriteOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  }
  const draftCheck = validateFirmwareConfigurationDraft(parsed.data.draft);
  if (!draftCheck.ok) return { ok: false, detail: `embedded draft rejected: ${draftCheck.detail}` };
  const registered = PREBUILT_FIRMWARE_IMAGES[parsed.data.draft.firmware_template_id];
  if (!registered || registered.file !== parsed.data.image.file) {
    return { ok: false, detail: 'write order image does not match the reviewed prebuilt image for its template' };
  }
  if (actual?.image_file !== undefined && actual.image_file !== parsed.data.image.file) {
    return { ok: false, detail: `image file mismatch: order authorizes ${parsed.data.image.file}, got ${actual.image_file}` };
  }
  if (actual?.image_sha256 !== undefined && actual.image_sha256 !== parsed.data.image.sha256) {
    return { ok: false, detail: 'image sha256 mismatch: the file on disk is not the image this order authorizes' };
  }
  return { ok: true, order: parsed.data };
}
