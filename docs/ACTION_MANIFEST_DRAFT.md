# Action Manifest — Design Draft (v0)

Status: APPROVED 2026-07-08 (all three decision points resolved; delegated to
and decided by the assistant, confirmed by owner). Implementation targets
v0.4 and does not start before real-device acceptance closes v0.2/v0.3.

## Goal

Let users compose new named actions for their device ("scan_left_to_right",
"nudge_and_check") from existing capability primitives — through data, never
code — so the capability list stops being a product ceiling (PRODUCT_VISION
pillar 2).

## Non-negotiable safety architecture

A manifest is an UNTRUSTED declarative document, exactly like an LLM proposal
or a marketplace asset (invariant 5):

```
Action Manifest (JSON, zod .strict())
  └── schema validation (unknown fields/actions rejected)
        └── expansion to primitive steps (pure function, no code execution)
              └── EXISTING pipeline per primitive: kernel capability check
                    → autonomy rules → SafetyGovernor → SafetyMonitor
```

Consequences:

1. A manifest cannot grant a device an ability its profile lacks — expansion
   only emits primitives the DeviceProfile already declares; anything else is
   `manifest_rejected`, never a guess.
2. Per-primitive safety evaluation is unavoidable: "trust the composite" is
   structurally impossible because the runtime only ever sees primitives.
3. A custom action interrupted mid-sequence by an interlock stops with zero
   further frames (requires the v0.4 sensor subscription model).

## Manifest shape (proposed)

```json
{
  "manifest_version": 1,
  "action_id": "scan_left_to_right",
  "display_name": { "zh": "从左到右扫描", "en": "Scan left to right" },
  "device_type": "robot_arm",
  "safety": {
    "declared_risk": "low",
    "required_sensors": ["distance"],
    "envelope": { "max_speed": "normal", "max_force": "low" }
  },
  "steps": [
    { "action": "move_to_pose", "target": "left_safe_zone", "speed": "slow" },
    { "action": "scan_area" },
    { "action": "move_to_pose", "target": "right_safe_zone", "speed": "slow" },
    { "action": "return_home" }
  ]
}
```

Rules: `steps[].action` restricted to the device's primitive union (same
technique as the LLM compiler's per-device zod schema); `declared_risk` gets
ZERO weight (recomputed by rules, same as LLM risk_level); an undeclared
`safety` block ⇒ rejected (default-block, invariant 2); envelope values may
only be equal to or tighter than the device profile's — looser is rejected,
never clamped.

## Storage & UI

- Manifests live beside the workspace project file; import/export as JSON.
- Capability editor UI: pick primitives, set per-step params from dropdowns
  bounded by the profile (no free-text params in v0).
- Custom actions surface in the prompt layer as new known intents; the LLM
  compiler's system prompt gains their ids automatically (they are data).

## Testing plan (release gates)

1. Cooperating-malicious manifest suite: manifests that declare loose
   envelopes, undeclared sensors, unknown primitives, or forbidden-zone
   targets — 100% rejected or blocked downstream.
2. Interlock interruption: custom action stopped mid-sequence ⇒ zero further
   frames, audit shows the stop reason.
3. Equivalence: a manifest reproducing an existing canonical task must yield
   the same decision as the keyword path.

## Decisions (confirmed 2026-07-08)

1. **Sources in v0.4: local creation + file import only.** Marketplace/URL
   distribution waits for v0.6 signing. DECIDED.
2. **No nesting.** A custom action may reference primitives only — no
   recursion, no composition. Flat is auditable. DECIDED.
3. **Name collisions with built-ins: reject at import.** A manifest never
   shadows a built-in intent. DECIDED.

## Out of scope for v0

User scripts/plugins, conditional branching ("if distance < X then …" — the
safety layer owns conditions), loops, cross-device sequences, marketplace
publishing.
