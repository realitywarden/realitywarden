/**
 * Read-only diagnostics evidence and onboarding closure.
 *
 * After an authorized firmware write, the ONLY accepted proof that the board
 * is alive is a read-only diagnostics report (diagnose_hardware /
 * read_distance / diagnose_gpio_loopback). The report schema structurally
 * cannot name an actuation command, and the evidence it produces grants no
 * execution authority: the runtime evidence lock, actuation tickets, and
 * `real_adapter_enabled:false` are untouched.
 *
 * The closure record links the whole loop together — manual import →
 * reviewed profile → firmware draft → authorized write → read-only
 * diagnostics → the already-enabled simulation asset — and is itself only a
 * simulation-only fact sheet. It never upgrades a device beyond
 * `supported_adapters: ['simulator']`.
 */
import { z } from 'zod';
import { EXPECTED_FIRMWARE } from '../hardware/SetupAdvisor';
import { validateStoredManualImport, type ManualImportRecord } from '../manual-import/ManualProfileImport';
import { validateFirmwareWriteOrder, type FirmwareWriteOrder } from './FirmwareWriteOrder';

/** Every command a diagnostics report may claim. Actuation cannot be named. */
const READ_ONLY_DIAGNOSTIC_COMMANDS = ['diagnose_hardware', 'read_distance', 'diagnose_gpio_loopback'] as const;

export const readonlyDiagnosticsReportSchema = z.object({
  schema: z.literal('realitywarden.readonly-diagnostics-report'),
  schema_version: z.literal(1),
  port: z.string().min(1).max(120),
  captured_at: z.string().datetime(),
  commands_used: z.array(z.enum(READ_ONLY_DIAGNOSTIC_COMMANDS)).min(1).max(8),
  firmware: z.object({
    firmware: z.string().min(1).max(120),
    firmware_version: z.string().min(1).max(40),
    protocol_version: z.number().int().min(4),
    sensor_interface: z.enum(['pulse_width', 'serial_ttl']).nullable(),
    reports_device_ms: z.boolean(),
    /** Legacy firmware (no diagnostics) can never back onboarding evidence. */
    legacy: z.literal(false)
  }).strict(),
  samples: z.array(z.object({
    ok: z.boolean(),
    distance_cm: z.number().finite().optional(),
    device_ms: z.number().finite().nonnegative().optional()
  }).strict()).max(50)
}).strict();

export type ReadonlyDiagnosticsReport = z.infer<typeof readonlyDiagnosticsReportSchema>;

export const firmwareOnboardingEvidenceSchema = z.object({
  schema: z.literal('realitywarden.firmware-onboarding-evidence'),
  schema_version: z.literal(1),
  status: z.literal('diagnostics_verified'),
  verified_at: z.string().datetime(),
  order: z.unknown(),
  report: readonlyDiagnosticsReportSchema,
  /** Read-only diagnostics prove communication, never a physical outcome. */
  physical_outcome_verified: z.literal(false),
  execution_authority_granted: z.literal(false),
  real_adapter_enabled: z.literal(false)
}).strict();

export interface FirmwareOnboardingEvidence {
  schema: 'realitywarden.firmware-onboarding-evidence';
  schema_version: 1;
  status: 'diagnostics_verified';
  verified_at: string;
  order: FirmwareWriteOrder;
  report: ReadonlyDiagnosticsReport;
  physical_outcome_verified: false;
  execution_authority_granted: false;
  real_adapter_enabled: false;
}

export type DiagnosticsEvidenceResult =
  | { ok: true; evidence: FirmwareOnboardingEvidence }
  | { ok: false; detail: string };

const MIN_GOOD_DISTANCE_SAMPLES = 3;

export function recordOnboardingDiagnostics(input: {
  order: unknown;
  report: unknown;
}, now = new Date().toISOString()): DiagnosticsEvidenceResult {
  const orderCheck = validateFirmwareWriteOrder(input.order);
  if (!orderCheck.ok) return { ok: false, detail: `write order rejected: ${orderCheck.detail}` };
  const parsedReport = readonlyDiagnosticsReportSchema.safeParse(input.report);
  if (!parsedReport.success) {
    return {
      ok: false,
      detail: parsedReport.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    };
  }
  const report = parsedReport.data;
  if (report.firmware.firmware !== EXPECTED_FIRMWARE) {
    return { ok: false, detail: `device reports foreign firmware "${report.firmware.firmware}"; onboarding evidence requires ${EXPECTED_FIRMWARE}` };
  }
  if (report.firmware.reports_device_ms !== true) {
    return { ok: false, detail: 'firmware does not report a device-side clock (deviceMs); the safety gate would block all actuation (audit 2.2)' };
  }

  const draftUsesDistanceSensor = orderCheck.order.draft.components.some((component) => component.kind === 'hc_sr04');
  if (draftUsesDistanceSensor) {
    if (report.firmware.sensor_interface !== 'pulse_width') {
      return { ok: false, detail: 'the reviewed draft requires an HC-SR04 pulse-width sensor but the device does not report one' };
    }
    const goodSamples = report.samples.filter((sample) =>
      sample.ok === true
      && typeof sample.distance_cm === 'number'
      && sample.distance_cm >= 2 && sample.distance_cm <= 400
      && typeof sample.device_ms === 'number'
    );
    if (goodSamples.length < MIN_GOOD_DISTANCE_SAMPLES) {
      return {
        ok: false,
        detail: `interlock sensor unproven: need at least ${MIN_GOOD_DISTANCE_SAMPLES} plausible distance samples with device clock, got ${goodSamples.length}`
      };
    }
  }

  return {
    ok: true,
    evidence: {
      schema: 'realitywarden.firmware-onboarding-evidence',
      schema_version: 1,
      status: 'diagnostics_verified',
      verified_at: now,
      order: orderCheck.order,
      report,
      physical_outcome_verified: false,
      execution_authority_granted: false,
      real_adapter_enabled: false
    }
  };
}

export const onboardingClosureSchema = z.object({
  schema: z.literal('realitywarden.device-onboarding-closure'),
  schema_version: z.literal(1),
  status: z.literal('onboarded_simulation_only'),
  profile_id: z.string().min(1).max(160),
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  closed_at: z.string().datetime(),
  evidence: firmwareOnboardingEvidenceSchema,
  execution_authority_granted: z.literal(false),
  real_adapter_enabled: z.literal(false)
}).strict();

export type OnboardingClosureResult =
  | { ok: true; closure: z.infer<typeof onboardingClosureSchema> & { evidence: FirmwareOnboardingEvidence } }
  | { ok: false; detail: string };

/**
 * Close the onboarding loop for one device. Requires:
 * - a valid manual-import record whose simulation asset was ALREADY enabled
 *   through the existing Virtual Lab second gate (this function never enables
 *   anything itself);
 * - diagnostics evidence whose draft points at exactly this record (profile
 *   id AND manual source digest);
 * - the record to remain structurally simulation-only.
 */
export function completeOnboardingClosure(input: {
  record: ManualImportRecord;
  evidence: unknown;
  builtinIntentIds: ReadonlySet<string>;
}, now = new Date().toISOString()): OnboardingClosureResult {
  const recordCheck = validateStoredManualImport(input.record, input.builtinIntentIds);
  if (!recordCheck.ok) return { ok: false, detail: `manual record rejected: ${recordCheck.detail}` };
  const record = recordCheck.record;
  if (!record.virtual_lab?.enabled || record.virtual_lab.execution_mode !== 'simulation') {
    return { ok: false, detail: 'onboarding closure requires the simulation asset to be enabled through the Virtual Lab gate first' };
  }
  if (record.device_meta.supported_adapters.length !== 1 || record.device_meta.supported_adapters[0] !== 'simulator') {
    return { ok: false, detail: 'onboarding closure requires a structurally simulation-only device record' };
  }
  const evidenceParsed = firmwareOnboardingEvidenceSchema.safeParse(input.evidence);
  if (!evidenceParsed.success) {
    return { ok: false, detail: evidenceParsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  }
  // The evidence embeds the order as unknown; revalidate it fully.
  const revalidated = recordOnboardingDiagnostics(
    { order: evidenceParsed.data.order, report: evidenceParsed.data.report },
    evidenceParsed.data.verified_at
  );
  if (!revalidated.ok) return { ok: false, detail: `stored evidence rejected: ${revalidated.detail}` };
  const evidence = revalidated.evidence;
  if (evidence.order.draft.reviewed_profile_id !== record.device_meta.profile_id) {
    return { ok: false, detail: 'diagnostics evidence belongs to a different reviewed profile' };
  }
  if (evidence.order.draft.source_sha256 !== record.source.sha256) {
    return { ok: false, detail: 'diagnostics evidence was drafted from a different manual source (sha256 mismatch)' };
  }
  const closure = onboardingClosureSchema.parse({
    schema: 'realitywarden.device-onboarding-closure',
    schema_version: 1,
    status: 'onboarded_simulation_only',
    profile_id: record.device_meta.profile_id,
    source_sha256: record.source.sha256,
    closed_at: now,
    evidence,
    execution_authority_granted: false,
    real_adapter_enabled: false
  });
  return { ok: true, closure: { ...closure, evidence } };
}
