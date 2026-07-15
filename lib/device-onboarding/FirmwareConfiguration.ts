import { z } from 'zod';
import { DeviceTypeSchema } from '../schemas/deviceMeta.schema';

const SAFE_ESP32_S3_GPIO = new Set([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21]);
const gpioSchema = z.number().int().refine((pin) => SAFE_ESP32_S3_GPIO.has(pin), 'GPIO is outside the conservative ESP32-S3 onboarding allowlist');

const servoSchema = z.object({
  kind: z.literal('sg90_servo'),
  pwm_pin: gpioSchema,
  min_angle: z.number().int().min(0).max(180),
  max_angle: z.number().int().min(0).max(180)
}).strict();

const distanceSchema = z.object({
  kind: z.literal('hc_sr04'),
  trigger_pin: gpioSchema,
  echo_pin: gpioSchema,
  min_safe_distance_cm: z.number().finite().positive().max(400)
}).strict();

const digitalOutputSchema = z.object({
  kind: z.literal('digital_output'),
  output_pin: gpioSchema,
  active_high: z.boolean(),
  safe_default: z.literal(false)
}).strict();

export const firmwareComponentSchema = z.discriminatedUnion('kind', [servoSchema, distanceSchema, digitalOutputSchema]).superRefine((value, context) => {
  if (value.kind === 'sg90_servo' && value.min_angle >= value.max_angle) context.addIssue({ code: z.ZodIssueCode.custom, message: 'servo min_angle must be lower than max_angle' });
  if (value.kind === 'hc_sr04' && value.trigger_pin === value.echo_pin) context.addIssue({ code: z.ZodIssueCode.custom, message: 'HC-SR04 trigger and echo pins must differ' });
});
export type FirmwareComponent = z.infer<typeof firmwareComponentSchema>;

const draftInputSchema = z.object({
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewed_profile_id: z.string().min(1).max(160),
  device_type: DeviceTypeSchema,
  board: z.literal('esp32_s3'),
  components: z.array(firmwareComponentSchema).min(1).max(8),
  human_review_confirmed: z.boolean()
}).strict();

export const firmwareConfigurationDraftSchema = z.object({
  schema: z.literal('realitywarden.firmware-configuration-draft'),
  schema_version: z.literal(1),
  status: z.literal('draft'),
  source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  reviewed_profile_id: z.string().min(1).max(160),
  device_type: DeviceTypeSchema,
  board: z.literal('esp32_s3'),
  protocol: z.literal('realitywarden_serial_v4'),
  baud_rate: z.literal(115200),
  firmware_template_id: z.enum(['esp32_s3_sg90_hc_sr04_v1', 'esp32_s3_digital_output_v1', 'esp32_s3_hc_sr04_read_only_v1']),
  components: z.array(firmwareComponentSchema).min(1).max(8),
  simulation_only: z.literal(true),
  write_authorized: z.literal(false),
  real_adapter_enabled: z.literal(false),
  human_review: z.object({ confirmed: z.literal(true), confirmed_at: z.string().datetime() }).strict()
}).strict();

export type FirmwareConfigurationDraft = z.infer<typeof firmwareConfigurationDraftSchema>;
export type FirmwareDraftResult = { ok: true; draft: FirmwareConfigurationDraft } | { ok: false; detail: string };

export function createFirmwareConfigurationDraft(raw: unknown, now = new Date().toISOString()): FirmwareDraftResult {
  const parsed = draftInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  if (!parsed.data.human_review_confirmed) return { ok: false, detail: 'explicit firmware-configuration review confirmation is required' };
  const compatibility = validateComponentCompatibility(parsed.data.device_type, parsed.data.components);
  if (!compatibility.ok) return compatibility;
  const pins = collectPins(parsed.data.components);
  if (new Set(pins).size !== pins.length) return { ok: false, detail: 'every configured component pin must be unique' };
  const firmwareTemplateId = templateFor(parsed.data.device_type, parsed.data.components);
  if (!firmwareTemplateId) return { ok: false, detail: 'no reviewed firmware template exists for this device/component combination' };
  const draft = firmwareConfigurationDraftSchema.parse({
    schema: 'realitywarden.firmware-configuration-draft', schema_version: 1, status: 'draft',
    source_sha256: parsed.data.source_sha256, reviewed_profile_id: parsed.data.reviewed_profile_id,
    device_type: parsed.data.device_type, board: parsed.data.board, protocol: 'realitywarden_serial_v4', baud_rate: 115200,
    firmware_template_id: firmwareTemplateId, components: parsed.data.components,
    simulation_only: true, write_authorized: false, real_adapter_enabled: false,
    human_review: { confirmed: true, confirmed_at: now }
  });
  return { ok: true, draft };
}

export function validateFirmwareConfigurationDraft(raw: unknown): FirmwareDraftResult {
  const parsed = firmwareConfigurationDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  const compatibility = validateComponentCompatibility(parsed.data.device_type, parsed.data.components);
  if (!compatibility.ok) return compatibility;
  const pins = collectPins(parsed.data.components);
  if (new Set(pins).size !== pins.length) return { ok: false, detail: 'every configured component pin must be unique' };
  if (templateFor(parsed.data.device_type, parsed.data.components) !== parsed.data.firmware_template_id) return { ok: false, detail: 'firmware template does not match the reviewed component set' };
  return { ok: true, draft: parsed.data };
}

function validateComponentCompatibility(deviceType: z.infer<typeof DeviceTypeSchema>, components: readonly FirmwareComponent[]): { ok: true } | { ok: false; detail: string } {
  const kinds = components.map((component) => component.kind);
  const allowed: Partial<Record<typeof deviceType, readonly FirmwareComponent['kind'][]>> = {
    robot_arm: ['sg90_servo', 'hc_sr04'], smart_light: ['digital_output'], sensor_box: ['hc_sr04']
  };
  const allowedKinds = allowed[deviceType];
  if (!allowedKinds || kinds.some((kind) => !allowedKinds.includes(kind))) return { ok: false, detail: `component set is not supported for ${deviceType}` };
  if (new Set(kinds).size !== kinds.length) return { ok: false, detail: 'duplicate component kinds are rejected in the first hardware matrix' };
  if (deviceType === 'robot_arm' && !(kinds.includes('sg90_servo') && kinds.includes('hc_sr04'))) return { ok: false, detail: 'robot_arm requires the reviewed SG90 + HC-SR04 interlocked template' };
  return { ok: true };
}

function templateFor(deviceType: z.infer<typeof DeviceTypeSchema>, components: readonly FirmwareComponent[]): FirmwareConfigurationDraft['firmware_template_id'] | null {
  const kinds = new Set(components.map((component) => component.kind));
  if (deviceType === 'robot_arm' && kinds.has('sg90_servo') && kinds.has('hc_sr04')) return 'esp32_s3_sg90_hc_sr04_v1';
  if (deviceType === 'smart_light' && kinds.size === 1 && kinds.has('digital_output')) return 'esp32_s3_digital_output_v1';
  if (deviceType === 'sensor_box' && kinds.size === 1 && kinds.has('hc_sr04')) return 'esp32_s3_hc_sr04_read_only_v1';
  return null;
}

function collectPins(components: readonly FirmwareComponent[]): number[] {
  return components.flatMap((component) => component.kind === 'sg90_servo'
    ? [component.pwm_pin]
    : component.kind === 'hc_sr04'
      ? [component.trigger_pin, component.echo_pin]
      : [component.output_pin]);
}
