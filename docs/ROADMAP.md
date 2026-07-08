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

## Now: Real-Device Acceptance (v0.2 close-out)

- run the four-scenario real-device acceptance on the reference kit
  (ESP32 + SG90 + HC-SR04), per `REAL_HARDWARE_ESP32.md`
- `npm run verify` green on the Windows host (build included)
- close visual-review leftovers (neutral-gray inline hex consolidation)
- after acceptance passes: delete the three `@deprecated` legacy adapter
  files (`RealDeviceAdapter.ts`, `MockDeviceTransport.ts`,
  `DeviceTransport.ts`)

## Next: v0.3 — Real Hardware in the Product

- wire `lib/hardware/` into the main UI: explicit `REAL HARDWARE` device
  identity + connection wizard
- LLM compiler UI wiring per the approved `LLM_COMPILER_DRAFT.md` (status
  chip, `[COMPILER]` log lines, explicit fallback badge)
- one-click firmware flashing MVP for the reference kit
- keep simulation the default path; real hardware is always opt-in and
  visibly distinct

## Next: Ecosystem Surface

- improve Reality Asset Catalog presentation
- keep "Build a Reality Asset in 10 minutes" documentation current
- show how robots, sensors, smart devices, lab equipment, factory systems,
  and electronic toys can be represented as Reality Assets
- clarify how developers can contribute simulation-only assets
- clarify how future adapters, simulation packs, safety rules, audit
  templates, and deployment workflows form around the protocol

## Later: v0.4–v0.6 (detail in PRODUCT_VISION.md)

- v0.4: user-defined actions (declarative Action Manifest + capability
  editor), sensor polling/subscription model
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
