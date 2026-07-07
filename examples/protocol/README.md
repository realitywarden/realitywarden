# Open Reality Protocol Example Artifacts

These files are generated from the current built-in device asset library.

They are not conceptual placeholders. They are repository-tracked protocol example artifacts that developers can inspect directly.

## Files

- `openreality-protocol-v0.1.catalog.json`
  - full protocol-shaped export of built-in assets
- `openreality-protocol-v0.1.runnable.json`
  - only the assets currently runnable in the simulation-only Public Alpha desktop flow
- `openreality-protocol-v0.1.support-matrix.json`
  - a lightweight consumer-facing summary of support boundaries and normalized capabilities
- `openreality-protocol-v0.1.consumer-example.json`
  - a developer-facing example of how a runtime or adapter intake layer can consume protocol artifacts and gate runnable vs protocol-only assets
- `openreality-protocol-v0.1.adapter-intake.json`
  - a minimal protocol-to-adapter intake example showing which assets can bind to the simulation runtime and which must remain protocol-only

## Regenerate

```bash
npm run protocol:export
npm run protocol:consume-example
npm run protocol:adapter-intake-example
```

## Current Public Alpha Boundary

The runnable subset should remain limited to:

- `robot_arm`
- `smart_light`
- `camera_sensor`

Everything else may still appear in the full catalog as protocol-shaped assets, but must not be treated as runnable in the main Public Alpha Run flow.
