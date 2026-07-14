# Adapter SDK Boundary

> Historical v0.2 design note. The current product retains this dry-run Adapter
> SDK boundary for third-party adapters; the separately documented ESP32
> reference rig now uses `HardwareExecutionGate`, not this public SDK surface.

## Scope

This layer exists to answer one question:

How will future real devices consume validated `TaskDSL` without letting product UI or LLM output bypass safety?

## Current Rules

- third-party real-device execution through this SDK is disabled
- all adapter plans are `dryRunOnly`
- supported adapter modes are:
  - `simulation`
  - `read_only`
  - `real_disabled`

## Current Simulation Adapter Examples

The repository now exposes minimal adapter-boundary examples for:

- `robot_arm`
- `smart_light`
- `camera_sensor`

These are boundary examples only. They do not change the current execution flow.

## Important Boundary

`AdapterPlan` is not a hardware command stream.

It is a validated adapter-facing plan derived from `TaskDSL`, with:

- target device id
- steps
- required permissions
- safety envelope
- `dryRunOnly: true`

## Validation

Run:

```bash
npm run test:adapter-sdk
```

This verifies:

- runnable `TaskDSL` can enter simulation adapters
- all real adapters remain disabled
- Coming Soon devices do not expose runnable adapters
- unsupported capabilities cannot compile into adapter plans
