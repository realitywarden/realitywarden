# Roadmap

This roadmap is intentionally narrow. The priority is not feature count. The priority is making the public surface honest, stable, understandable, and clearly positioned around an open Physical AI ecosystem.

Open Reality is not trying to build robots or chips.

The direction is a universal software runtime that helps ordinary hardware become AI-controllable through Reality Assets, capability contracts, simulation-first action paths, adapter boundaries, and audit logs.

## Now: Public Alpha

Current focus:

- keep `robot_arm` stable as the primary runnable path
- keep `smart_light` and `camera_sensor` stable as low-risk runnable paths
- show the core story clearly: natural-language goal -> runtime -> checked simulation path
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
- make Reality Asset creation easier to understand
- make the app look more like a universal runtime and less like a single robot demo

## Next: Ecosystem Surface

- improve Reality Asset Catalog presentation
- add clearer "Build a Reality Asset in 10 minutes" documentation
- show how robots, sensors, smart devices, lab equipment, factory systems, and electronic toys can be represented as Reality Assets
- clarify how developers can contribute simulation-only assets
- clarify how future adapters, simulation packs, safety rules, audit templates, and deployment workflows could form around the protocol

## Later: Simulator Depth

- richer state editors
- scenario editor
- stronger playback inspection
- deeper per-device semantic action coverage
- better multi-device workspace behavior
- clearer safe / corrected / blocked execution outcomes

## Later: Real Device Research Boundary

Only after the Public Alpha surface is clean and the simulation-first protocol is stable:

- research low-risk real-device adapter boundaries
- explore read-only or low-risk device integration paths
- keep local runtime gating before any real-device route
- keep human approval and audit trail requirements explicit
- do not claim certified safety or production hardware readiness

## Not In Public Alpha Scope

These are explicitly out of scope until after Public Alpha is clean:

- live device execution
- LocalRuntime / EdgeRuntime for hardware operation
- vendor-certified safety claims
- protocol expansion for every device family
- enabling every scaffolded device in main Run
- claiming that purely mechanical objects without chips, controllers, sensors, actuators, motors, or interfaces can be changed by software alone