# Adapter SDK Example

This directory contains the smallest current developer-facing Adapter SDK onboarding example.

It does not enable real devices.

It does not change the product runtime.

It shows how a developer can consume protocol artifacts and build a simulation-only adapter stub without silently expanding Public Alpha boundaries.

## Files

- `openreality-adapter-sdk-v0.1.intake-summary.json`
  - summary of accepted vs protocol-only assets for Public Alpha adapter intake
- `simulation-adapter.stub.ts`
  - minimal TypeScript adapter stub that enforces the current simulation-only boundary

## Generate

```bash
npm run protocol:adapter-sdk-example
```

## Boundary

This example must remain aligned with the current Public Alpha truth:

- runnable: `robot_arm`, `smart_light`, `camera_sensor`
- protocol-only: all other built-in device families
- real device execution: disabled
