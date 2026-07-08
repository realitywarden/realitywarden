# LLM Task Compiler — Design Draft (v0)

Status: IMPLEMENTED 2026-07-08. Core: `lib/compiler/llm/` + `tests/llm-compiler/`
(15 tests, both release gates green). UI wiring shipped: status chip beside the
prompt box, `[COMPILER]` provenance line per run, async compile state, explicit
fallback badge. Integration: validated proposals are bridged
(`lib/compiler/llm/proposalBridge.ts`) into the EXISTING kernel Goal + autonomy
SemanticIntent inputs — every safety layer runs unchanged downstream; unmappable
proposals fall back to the rules compiler with an `llm_compiler_fallback` audit
entry. Real-device acceptance remains pending separately.

## Goal

Replace the keyword-matching language layer (`SemanticCore` + `mockTaskCompiler`)
with a real LLM, so users can phrase commands freely instead of hitting a fixed
vocabulary — while every safety guarantee stays exactly where it is today.

Model: local **Ollama** running `qwen2.5:3b` (no cloud dependency, no API key,
works offline; ~2GB download, runs on CPU).

## Non-negotiable safety architecture

The LLM is treated as an UNTRUSTED text generator. It gets no tools, no device
access, no execution authority. Its only output is a TaskDSL JSON *proposal*,
and every proposal flows through the exact same pipeline that exists today:

```
user prompt
  └── LlmTaskCompiler (NEW, untrusted proposal generator)
        └── zod schema validation (strict; unknown fields rejected)
              └── Runtime Kernel capability check      (unchanged)
                    └── AutonomyCore / RiskJudge rules  (unchanged)
                          └── SafetyGovernor envelope   (unchanged)
                                └── SafetyMonitor gate  (unchanged)
```

Consequences of this placement:

1. A hallucinated action (`launch_rocket`) fails zod validation → explicit
   `unsupported` result, never a guess (no-silent-fallback invariant).
2. A legal-looking but unsafe proposal (`throw_object`, angle 200) is blocked
   by the SAME rules that block it today. The LLM cannot weaken any invariant
   because it sits strictly upstream of all of them.
3. The audit log records `compiler: 'llm' | 'rules'` on every run, so a report
   always shows which layer produced the TaskDSL (honesty invariant).

## Interface

```ts
// lib/compiler/LlmTaskCompiler.ts (planned)
interface LlmTaskCompilerOptions {
  baseUrl?: string;        // default http://127.0.0.1:11434
  model?: string;          // default 'qwen2.5:3b'
  timeoutMs?: number;      // default 8000
}

interface LlmCompileResult {
  ok: boolean;
  taskDsl?: TaskDSL;       // present only when schema validation passed
  compiler: 'llm';
  raw?: string;            // raw model output, kept for the audit trail
  failure?: 'ollama_unreachable' | 'timeout' | 'invalid_json' | 'schema_rejected';
}
```

## Prompt design (single-shot, JSON-only)

System prompt (fixed, versioned in code):

- Declares the device's capability list and known targets (injected from the
  DeviceProfile — the model only ever sees capabilities that exist).
- Shows the TaskDSL JSON schema with 2 worked examples (one safe, one that
  correctly uses `risk_level: "high"` for a dangerous request — the model is
  told to label risk honestly, never to refuse; refusing is the safety
  layer's job, not the model's).
- Output contract: "Respond with a single JSON object. No prose, no markdown."
  Use Ollama's `format: "json"` option to force JSON mode.

## Validation (zod, strict)

- `zod` is already a dependency — no new packages needed.
- Schema mirrors `types/taskDsl.ts` exactly: `task_id`, `intent`,
  `risk_level ∈ {low,medium,high}`, `steps[]` with `action` restricted to the
  literal union of DeviceCapability values **for the selected device**, plus
  known `target` strings. `.strict()` so unknown fields are rejected.
- On failure: no retry loops in v0 (deterministic behavior first); return
  `schema_rejected` with the raw output preserved for the audit log.

## Fallback policy (rules engine demoted, not deleted)

```
try LLM (8s timeout)
  ├── ok        → TaskDSL{compiler:'llm'}    → safety pipeline
  └── any error → mockTaskCompiler           → TaskDSL{compiler:'rules'} → safety pipeline
                  + audit entry 'llm_compiler_fallback' with the failure kind
                  + UI badge "rule compiler (LLM offline)"
```

The fallback is EXPLICIT and visible — a user always knows which compiler ran
(no silent fallback). If neither compiler produces a valid TaskDSL, the run
stops with `not_runnable`, same as today.

## UI touchpoints (minimal, v0)

- Status chip next to the prompt box: `LLM: qwen2.5:3b` / `LLM offline — rule
  compiler active` (click → one-line setup hint: `ollama pull qwen2.5:3b`).
- Terminal log line per run: `[COMPILER] llm(qwen2.5:3b) produced TaskDSL in
  1.2s` or `[COMPILER] fallback to rules: ollama_unreachable`.

## Testing plan

1. **Unit (no Ollama needed):** fake fetch returning canned model outputs —
   valid TaskDSL, garbage JSON, valid JSON with hallucinated action, timeout.
   Assert: schema rejection paths, fallback firing, audit entries, and that a
   hallucinated action NEVER reaches the runtime kernel.
2. **Safety regression:** feed the LLM path the same unsafe prompts as the
   existing scenario table ("throw the red cube off the table" etc.) with a
   mocked model that *cooperates* (emits the unsafe TaskDSL) — assert the
   downstream pipeline still blocks every one. This is the key test: safety
   must not depend on the model behaving.
3. **Integration (manual, gated):** `npm run llm:smoke` — requires local
   Ollama; runs 10 canonical prompts and prints TaskDSL + decision table.

## Decisions (confirmed 2026-07-06)

- **`risk_level`: model output gets ZERO weight.** The rules layer always
  recomputes risk; the model's value is discarded (logged in `raw` for audit
  only). DECIDED.
- **Acceptance hard requirement:** the "cooperating-malicious model" test —
  a mocked model that willingly emits unsafe TaskDSL — must show every unsafe
  proposal blocked downstream. This is a release gate, not a nice-to-have.

- **System prompt language: English.** One maintained prompt (capability
  list, schema, examples), plus the rule "output a single JSON object
  regardless of the input language". zh/en user prompts both supported.
  DECIDED.
- **Latency: 1–4s on CPU accepted for v0.** UI shows a static
  `[COMPILER] compiling…` state; streaming output and progress UI are
  deferred to a later version. DECIDED.

## Explicitly out of scope for v0

Multi-turn clarification dialogues, retry-with-feedback loops, cloud model
support, fine-tuning, prompt-injection hardening beyond JSON-schema
validation (the safety pipeline is the real defense), and any change to the
safety layers themselves.
