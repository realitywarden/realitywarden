# RealityWarden v0.3.0 Public Alpha Release Notes

RealityWarden v0.3.0 is a software-complete Public Alpha desktop build for
simulation-first Physical AI workflows and one explicitly gated reference
hardware rig. It does not claim general hardware compatibility, physical-motion
verification, industrial safety certification, or production readiness.

## Highlights since v0.1.1

- Product-grade Electron desktop layout centered on the 3D Workspace, AI
  Command Terminal, evidence sidebar, playback console, and independent REAL
  HARDWARE danger boundary.
- Local LLM compiler integration with explicit rule fallback; every proposal
  still enters the same deterministic runtime and safety pipeline.
- Versioned Action Manifest composer plus atomic JSON action-library
  import/export. Unknown fields, unsafe envelopes, duplicate IDs, and overwrite
  attempts are rejected rather than repaired or clamped.
- Editable 3D forbidden zones backed by the same profile constraints consumed
  by Runtime/Safety; edits invalidate stale reports and validation evidence.
- Windows NSIS installer containing the compiled shared safety runtime, Next
  production runtime, signed-by-checksum prebuilt firmware assets, and Windows
  serialport native bindings.

## Real-hardware boundary

The main AI Command flow stays simulation-only and requires no device. The REAL
HARDWARE panel is a separate, visually distinct secondary path for the
documented ESP32 + SG90 + HC-SR04 bench rig. Actuation requires:

1. the evidence lock or explicit supervised bench override;
2. per-run operator confirmation;
3. fresh, plausible sensor evidence and device timestamps;
4. SafetyMonitor approval;
5. the gate-private ticket path through HardwareExecutionGate.

Blocked decisions emit zero actuation frames. Delivery evidence distinguishes
`not_sent`, `attempted_unconfirmed`, and `device_acknowledged`. Because the SG90
is open-loop, success is recorded as `command_acknowledged_open_loop` with
`physicalOutcomeVerified:false`; acknowledgement is never presented as proof
that the shaft reached the requested angle.

## Supported product paths

Simulation-enabled main paths remain intentionally narrow:

- `robot_arm`
- `smart_light`
- `camera_sensor`

Other built-in families remain Coming Soon or asset-only. Custom actions expand
to supported primitives and cannot upgrade an unsupported device into a
runnable one.

## Verification evidence

- three TypeScript projects pass type checking;
- Next.js production build passes;
- real-hardware safety invariants: **39/39**;
- virtual serial loopback acceptance: **5/5**;
- Desktop and Conformance source-contract checks pass;
- full `npm run verify` passes;
- `npm run desktop:pack` verifies package contents and runs the packaged
  `RealityWarden.exe --prod --smoke-test` path.

Expected Windows artifact:

```text
release/RealityWarden-0.3.0-Setup.exe
```

## Known limitations

- Public Alpha, not a production-certified control system.
- Reference hardware support is limited to the documented bench rig.
- Physical reference-kit acceptance is optional field evidence, not a software
  completion or release-engineering gate.
- The bundled demo video predates some current UI and evidence surfaces; it is
  historical illustration, not release verification.
- Local LLM use depends on a reachable configured Ollama runtime; fallback is
  explicit and audited.
