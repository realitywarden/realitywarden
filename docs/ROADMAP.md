# Roadmap

This roadmap is intentionally narrow. The priority is not feature count. The
priority is keeping the public surface honest, stable, usable, and clearly
positioned around an open Physical AI ecosystem.

RealityWarden is not trying to build robots or chips. The direction is a
universal software runtime that helps ordinary hardware become
AI-controllable through Reality Assets, capability contracts,
simulation-first action paths, adapter boundaries, and audit logs.

Product direction and the full v0.3–v0.6 plan live in `PRODUCT_VISION.md`;
this file only tracks execution order. The six invariants defined there bind
every item below.

## Completed: Real-Device Software Boundary (v0.2 close-out)

- pass the automated real-hardware and virtual-loopback suites, including the
  four safety scenarios and explicit `hardwareSignalSent` evidence
- `npm run verify` green on the Windows host (build included)
- close visual-review leftovers (neutral-gray inline hex consolidation)
- removed the three superseded generic real-adapter files after confirming zero
  production references; the ticketed `lib/hardware/` boundary is authoritative

Physical reference-kit validation remains an optional field check documented in
`REAL_HARDWARE_ESP32.md`; it is not a product-completion or development gate.

## Completed: v0.3 — Real Hardware in the Product

- wire `lib/hardware/` into the main UI: explicit `REAL HARDWARE` device
  identity + connection wizard
- LLM compiler UI wiring per the approved `LLM_COMPILER_DRAFT.md` (status
  chip, `[COMPILER]` log lines, explicit fallback badge)
- one-click firmware flashing MVP for the reference kit
- keep simulation the default path; real hardware is always opt-in and
  visibly distinct

The v0.3.0 Public Alpha installer is the release-closure artifact for this
milestone. Physical rig evidence remains optional and does not block the
software release pipeline.

## Next: Ecosystem Surface

- improve Reality Asset Catalog presentation
- keep "Build a Reality Asset in 10 minutes" documentation current
- show how robots, sensors, smart devices, lab equipment, factory systems,
  and electronic toys can be represented as Reality Assets
- clarify how developers can contribute simulation-only assets
- clarify how future adapters, simulation packs, safety rules, audit
  templates, and deployment workflows form around the protocol

## Completed: v0.4 — Your Device, Your Actions

- completed: versioned Action Manifest composer and primitive expansion through
  the unchanged safety pipeline
- completed: strict atomic action-library JSON import/export
- completed: 3D forbidden-zone visualization and editing backed by profile
  constraints
- completed: sensor polling/subscription with a fresh evidence generation per
  primitive; failed reads and latched clock/frozen faults interrupt a sequence
  with zero further actuation frames
- completed: Robot Arm, Smart Light, and Camera Sensor reference recipes;
  exact device-profile matching; typed/ranged smart-light values; one-click
  recipe loading through the same validator; semantic execution coverage

The v0.4 gate is green: the cooperating-malicious suite rejects unsafe
proposals, polling interruption proves zero later frames, all three recipes
pass their normal safety path, and the full repository verify chain passes.

## Next: v0.5–v0.6 (detail in PRODUCT_VISION.md)

- v0.5: manual import — datasheet/PDF to draft DeviceProfile via local LLM,
  human-reviewed, simulation-first enablement
- v0.6: ecosystem marketplace alpha — declarative assets only, signed,
  trust-tiered, disabled-by-default on install

## Standing rules (unchanged)

- show the core story clearly: natural-language goal -> runtime -> checked
  simulation path
- unsupported prompts never silently execute
- non-ready devices stay behind `Coming Soon`
- build / verify / smoke tests stay green

## Not In Scope Through v0.6

- vendor-certified industrial safety claims
- cloud dependency for any safety decision
- marketplace distribution of executable code
- protocol changes that are not additive
- paid marketplace transactions
- claiming that purely mechanical objects without chips, controllers,
  sensors, actuators, motors, or interfaces can be changed by software alone
