/**
 * LLM Task Compiler v0 — implements docs/LLM_COMPILER_DRAFT.md (APPROVED).
 *
 * The LLM (local Ollama, default qwen2.5:3b) is an UNTRUSTED proposal
 * generator. It has no tools, no device access, no execution authority. Its
 * output is validated by a strict zod schema built from the device's actual
 * capabilities, its risk_level gets ZERO weight (recomputed by rules), and
 * every proposal still flows through the unchanged downstream safety pipeline
 * (Runtime Kernel → AutonomyCore → SafetyRuntime → SafetyMonitor).
 *
 * fetch is injectable so all tests run without Ollama.
 */
import { z } from 'zod';
import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskDSL, TaskStep } from '@/types/taskDsl';

export type LlmCompileFailure =
  | 'ollama_unreachable'
  | 'timeout'
  | 'invalid_json'
  | 'schema_rejected';

export interface LlmCompileResult {
  ok: boolean;
  taskDsl?: TaskDSL;
  compiler: 'llm';
  model: string;
  elapsedMs: number;
  /** Raw model output, preserved verbatim for the audit trail. */
  raw?: string;
  failure?: LlmCompileFailure;
  failureDetail?: string;
}

export type FetchLike = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
  signal?: AbortSignal;
}) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface LlmTaskCompilerOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: FetchLike;
}

const SPEEDS = ['slow', 'normal', 'fast'] as const;
const FORCES = ['low', 'medium', 'high'] as const;

/**
 * Build the strict per-device schema. `action` is restricted to the
 * capabilities the selected device actually declares; `target` to its known
 * targets. Unknown fields are rejected (.strict()) — a hallucinated field or
 * action fails validation instead of being guessed at.
 */
export function buildTaskDslSchema(deviceMeta: DeviceMeta) {
  const actions = deviceMeta.capabilities as [string, ...string[]];
  const knownTargets = (deviceMeta.constraints.known_targets ?? []) as string[];
  const stepSchema = z.object({
    id: z.string().min(1),
    action: z.enum(actions),
    target: knownTargets.length > 0 ? z.enum(knownTargets as [string, ...string[]]).optional() : z.string().optional(),
    speed: z.enum(SPEEDS).optional(),
    force: z.enum(FORCES).optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    zone: z.string().optional(),
    note: z.string().optional()
  }).strict();
  return z.object({
    task_id: z.string().min(1),
    intent: z.string().min(1),
    risk_level: z.enum(['low', 'medium', 'high']),
    steps: z.array(stepSchema).min(1).max(12)
  }).strict();
}

/**
 * RULE-BASED risk recomputation. The model's risk_level gets ZERO weight
 * (decided 2026-07-06): whatever it claims is discarded and replaced by these
 * deterministic rules. Conservative by construction — anything touching a
 * forbidden zone or a hard-boundary action is high.
 */
export function recomputeRiskLevel(steps: TaskStep[], deviceMeta: DeviceMeta): TaskDSL['risk_level'] {
  const forbidden = new Set(deviceMeta.constraints.forbidden_zones ?? []);
  const touchesForbidden = steps.some((step) =>
    (step.target !== undefined && forbidden.has(step.target))
    || (step.zone !== undefined && forbidden.has(step.zone))
    || step.target === 'outside_table'
    || step.zone === 'outside_table');
  const hardBoundaryAction = steps.some((step) => step.action === 'throw_object');
  if (hardBoundaryAction || touchesForbidden) return 'high';
  const aggressive = steps.some((step) => step.speed === 'fast' || step.force === 'high');
  if (aggressive) return 'medium';
  return 'low';
}

function buildSystemPrompt(deviceMeta: DeviceMeta): string {
  const capabilities = deviceMeta.capabilities.join(', ');
  const targets = (deviceMeta.constraints.known_targets ?? []).join(', ');
  return [
    'You translate a user command for a physical device into a TaskDSL JSON object.',
    'Respond with a single JSON object. No prose, no markdown, regardless of the input language (Chinese and English inputs are both expected).',
    `Device type: ${deviceMeta.device_type}. Allowed actions (use ONLY these): ${capabilities}.`,
    `Known targets (use ONLY these when a step needs a target): ${targets}.`,
    'JSON shape: {"task_id": string, "intent": string, "risk_level": "low"|"medium"|"high", "steps": [{"id": string, "action": string, "target"?: string, "speed"?: "slow"|"normal"|"fast", "force"?: "low"|"medium"|"high", "zone"?: string}]}.',
    'Translate the user\'s intent faithfully, even if it sounds unsafe — label risk_level honestly instead of refusing; a separate safety layer decides what may execute.',
    'Example 1 (safe): user "move the red cube to the back safe zone" =>',
    '{"task_id":"task-1","intent":"move the red cube to the back safe zone","risk_level":"low","steps":[{"id":"step-1","action":"identify_object","target":"red_cube","speed":"slow"},{"id":"step-2","action":"move_to_pose","target":"red_cube","speed":"normal"},{"id":"step-3","action":"grasp","target":"red_cube","force":"medium"},{"id":"step-4","action":"move_to_pose","target":"back_safe_zone","speed":"normal"},{"id":"step-5","action":"release","target":"back_safe_zone"},{"id":"step-6","action":"return_home"}]}',
    'Example 2 (dangerous, labeled honestly): user "shove the cube off the table fast" =>',
    '{"task_id":"task-2","intent":"shove the cube off the table fast","risk_level":"high","steps":[{"id":"step-1","action":"identify_object","target":"red_cube"},{"id":"step-2","action":"grasp","target":"red_cube","force":"high"},{"id":"step-3","action":"move_to_pose","target":"outside_table","speed":"fast"},{"id":"step-4","action":"release","target":"outside_table"}]}'
  ].join('\n');
}

export class LlmTaskCompiler {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;

  constructor(options: LlmTaskCompilerOptions = {}) {
    this.baseUrl = options.baseUrl ?? 'http://127.0.0.1:11434';
    this.model = options.model ?? 'qwen2.5:3b';
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  }

  async compile(prompt: string, deviceMeta: DeviceMeta): Promise<LlmCompileResult> {
    const started = Date.now();
    const base = { compiler: 'llm' as const, model: this.model };
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;

    let raw: string;
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          system: buildSystemPrompt(deviceMeta),
          prompt,
          format: 'json',
          stream: false,
          options: { temperature: 0 }
        }),
        signal: controller?.signal
      });
      if (!response.ok) {
        return {
          ...base, ok: false, elapsedMs: Date.now() - started,
          failure: 'ollama_unreachable',
          failureDetail: `Ollama HTTP ${response.status}`
        };
      }
      const envelope = JSON.parse(await response.text()) as { response?: string };
      raw = envelope.response ?? '';
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      return {
        ...base, ok: false, elapsedMs: Date.now() - started,
        failure: aborted ? 'timeout' : 'ollama_unreachable',
        failureDetail: error instanceof Error ? error.message : String(error)
      };
    } finally {
      if (timer) clearTimeout(timer);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        ...base, ok: false, elapsedMs: Date.now() - started, raw,
        failure: 'invalid_json', failureDetail: 'model output is not valid JSON'
      };
    }

    const validation = buildTaskDslSchema(deviceMeta).safeParse(parsed);
    if (!validation.success) {
      // No silent fallback at this layer: reject loudly, keep raw for audit.
      return {
        ...base, ok: false, elapsedMs: Date.now() - started, raw,
        failure: 'schema_rejected',
        failureDetail: validation.error.issues.slice(0, 3).map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
      };
    }

    const proposal = validation.data as TaskDSL;
    // Decided: the model's risk_level gets ZERO weight. Rules recompute it.
    const taskDsl: TaskDSL = {
      ...proposal,
      intent: prompt,
      risk_level: recomputeRiskLevel(proposal.steps, deviceMeta)
    };
    return { ...base, ok: true, elapsedMs: Date.now() - started, raw, taskDsl };
  }
}
