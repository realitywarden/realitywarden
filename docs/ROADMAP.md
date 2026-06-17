# Roadmap

This roadmap is intentionally narrow. The priority is not feature count. The priority is making the public surface look honest, stable, and usable.

## Now: Public Alpha

Current focus:

- keep `robot_arm` stable as the primary runnable path
- keep `smart_light` and `camera_sensor` stable as low-risk runnable paths
- keep unsupported prompts from silently executing
- keep non-public devices behind `Coming Soon`
- tighten language consistency for first-screen UX
- keep build / verify / smoke tests passing

## Next: Public Alpha Hardening

- reduce remaining zh/en mixed display values
- clean command status and log presentation
- improve README / docs / public support matrix
- tighten repo hygiene for public publishing
- improve deterministic smoke testing for the three public devices

## Later: Simulator Depth

- richer state editors
- scenario editor
- stronger playback inspection
- deeper per-device semantic action coverage
- better multi-device workspace behavior

## Not In Public Alpha Scope

These are explicitly out of scope until after Public Alpha is clean:

- real device execution
- LocalRuntime / EdgeRuntime for hardware control
- vendor-certified safety claims
- protocol expansion for every device family
- enabling every scaffolded device in main Run
