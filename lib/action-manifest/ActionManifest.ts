/**
 * Action Manifest core (v0.4, per docs/ACTION_MANIFEST_DRAFT.md — APPROVED).
 *
 * A manifest is UNTRUSTED data (invariant 5). This module only validates and
 * expands it into primitive TaskDSL steps; every expanded primitive then runs
 * through the EXISTING safety pipeline unchanged. "Trust the composite" is
 * structurally impossible: the runtime never sees anything but primitives.
 *
 * Decisions in force: local/file sources only; no nesting (primitives only);
 * name collisions with built-ins are rejected at import; declared_risk gets
 * ZERO weight (recomputed by the same rules as LLM proposals); an envelope
 * looser than the device profile is REJECTED, never clamped (invariant 2/5).
 */
import { z } from 'zod';
import { recomputeRiskLevel } from '../compiler/llm/LlmTaskCompiler';
import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskDSL, TaskStep } from '@/types/taskDsl';

const SPEED_ORDER = { slow: 0, normal: 1, fast: 2 } as const;
const FORCE_ORDER = { low: 0, medium: 1, high: 2 } as const;

export type ManifestRejectionCode =
  | 'schema_rejected'
  | 'device_type_mismatch'
  | 'unknown_primitive'
  | 'unknown_target'
  | 'invalid_value'
  | 'envelope_exceeds_profile'
  | 'name_collision';

export interface ManifestValidationFailure {
  ok: false;
  code: ManifestRejectionCode;
  detail: string;
}

export interface ManifestValidationSuccess {
  ok: true;
  manifest: ActionManifest;
}

const manifestStepSchema = z.object({
  action: z.string().min(1),
  target: z.string().optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  force: z.enum(['low', 'medium', 'high']).optional(),
  value: z.union([z.string().max(64), z.number().finite(), z.boolean()]).optional(),
  zone: z.string().optional(),
  note: z.string().optional()
}).strict();

export const actionManifestSchema = z.object({
  manifest_version: z.literal(1),
  action_id: z.string().regex(/^[a-z][a-z0-9_]{2,48}$/,
    'action_id must be snake_case, 3-49 chars'),
  display_name: z.object({ zh: z.string().min(1), en: z.string().min(1) }).strict(),
  device_type: z.string().min(1),
  safety: z.object({
    declared_risk: z.enum(['low', 'medium', 'high']),
    // Reserved in manifest v1. Real safety interlocks are profile/capability
    // owned and cannot be introduced by an untrusted manifest. Until a
    // profile-authoritative binding exists, non-empty proposals fail closed.
    required_sensors: z.array(z.string()).max(0, 'required_sensors is reserved in v1 and must be empty'),
    envelope: z.object({
      max_speed: z.enum(['slow', 'normal', 'fast']),
      max_force: z.enum(['low', 'medium', 'high'])
    }).strict()
  }).strict(),
  steps: z.array(manifestStepSchema).min(1).max(16)
}).strict();

export type ActionManifest = z.infer<typeof actionManifestSchema>;

/**
 * Validate untrusted manifest JSON against the schema, the device profile,
 * and the built-in intent namespace. Fails loudly with a code — no repair,
 * no clamping, no silent acceptance.
 */
export function validateActionManifest(
  raw: unknown,
  deviceMeta: DeviceMeta,
  builtinIntentIds: ReadonlySet<string>
): ManifestValidationSuccess | ManifestValidationFailure {
  const parsed = actionManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'schema_rejected',
      detail: parsed.error.issues.slice(0, 3)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    };
  }
  const manifest = parsed.data;

  if (manifest.device_type !== deviceMeta.device_type) {
    return {
      ok: false,
      code: 'device_type_mismatch',
      detail: `manifest device_type "${manifest.device_type}" does not match selected profile "${deviceMeta.device_type}"`
    };
  }

  if (builtinIntentIds.has(manifest.action_id)) {
    return {
      ok: false,
      code: 'name_collision',
      detail: `action_id "${manifest.action_id}" shadows a built-in intent; rejected (decision 3)`
    };
  }

  const capabilities = new Set(deviceMeta.capabilities as readonly string[]);
  const knownTargets = new Set(deviceMeta.constraints.known_targets ?? []);
  for (let index = 0; index < manifest.steps.length; index += 1) {
    const step = manifest.steps[index];
    if (!capabilities.has(step.action)) {
      return {
        ok: false,
        code: 'unknown_primitive',
        detail: `steps[${index}].action "${step.action}" is not a declared capability of ${deviceMeta.device_type}`
      };
    }
    if (step.target !== undefined && knownTargets.size > 0 && !knownTargets.has(step.target)) {
      return {
        ok: false,
        code: 'unknown_target',
        detail: `steps[${index}].target "${step.target}" is not a known target of this device`
      };
    }
    const valueError = validatePrimitiveValue(step.action, step.value);
    if (valueError) {
      return {
        ok: false,
        code: 'invalid_value',
        detail: `steps[${index}].value: ${valueError}`
      };
    }
  }

  const { envelope } = manifest.safety;
  if (SPEED_ORDER[envelope.max_speed] > SPEED_ORDER[deviceMeta.constraints.max_speed]
    || FORCE_ORDER[envelope.max_force] > FORCE_ORDER[deviceMeta.constraints.force_limit]) {
    return {
      ok: false,
      code: 'envelope_exceeds_profile',
      detail: `manifest envelope (${envelope.max_speed}/${envelope.max_force}) is looser than the device profile `
        + `(${deviceMeta.constraints.max_speed}/${deviceMeta.constraints.force_limit}); rejected, never clamped`
    };
  }

  return { ok: true, manifest };
}

/**
 * Expand a VALIDATED manifest into a primitive TaskDSL. Per-step speed/force
 * must not exceed the manifest's own envelope (the tighter of manifest and
 * profile, since validation already enforced manifest <= profile).
 * `declared_risk` is discarded: risk is recomputed by the shared rules.
 */
export function expandManifestToTaskDsl(
  manifest: ActionManifest,
  deviceMeta: DeviceMeta,
  prompt: string
): { ok: true; taskDsl: TaskDSL } | ManifestValidationFailure {
  const { envelope } = manifest.safety;
  const steps: TaskStep[] = [];
  for (let index = 0; index < manifest.steps.length; index += 1) {
    const step = manifest.steps[index];
    if ((step.speed && SPEED_ORDER[step.speed] > SPEED_ORDER[envelope.max_speed])
      || (step.force && FORCE_ORDER[step.force] > FORCE_ORDER[envelope.max_force])) {
      return {
        ok: false,
        code: 'envelope_exceeds_profile',
        detail: `steps[${index}] exceeds the manifest's own declared envelope; rejected`
      };
    }
    steps.push({
      id: `${manifest.action_id}-step-${index + 1}`,
      action: step.action as TaskStep['action'],
      target: step.target,
      speed: step.speed,
      force: step.force,
      value: step.value,
      zone: step.zone,
      note: step.note
    });
  }
  return {
    ok: true,
    taskDsl: {
      task_id: `task-manifest-${manifest.action_id}-${Date.now()}`,
      intent: prompt,
      risk_level: recomputeRiskLevel(steps, deviceMeta),
      steps
    }
  };
}

export const ACTION_MANIFEST_LIGHT_COLORS = [
  'white', 'warm_white', 'cool_white', 'red', 'green', 'blue', 'amber'
] as const;
const SAFE_LIGHT_COLORS = new Set<string>(ACTION_MANIFEST_LIGHT_COLORS);

/**
 * Action values are untrusted command arguments. A primitive may consume a
 * value only when this module has an explicit policy for its type/range.
 * Unknown value-bearing primitives fail closed instead of forwarding an
 * arbitrary payload into an adapter.
 */
function validatePrimitiveValue(action: string, value: string | number | boolean | undefined): string | null {
  if (action === 'set_light') {
    return typeof value === 'boolean' ? null : 'set_light requires a boolean';
  }
  if (action === 'set_brightness') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
      ? null
      : 'set_brightness requires a finite number in [0, 100]';
  }
  if (action === 'set_color') {
    return typeof value === 'string' && SAFE_LIGHT_COLORS.has(value)
      ? null
      : `set_color requires one of: ${Array.from(SAFE_LIGHT_COLORS).join(', ')}`;
  }
  return value === undefined ? null : `${action} has no declared value policy; value is rejected`;
}
