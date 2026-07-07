# Reality Asset Developer Kit

The Reality Asset Developer Kit is the local path for creating and validating device asset packages before they enter RealityWarden.

A Reality Asset is how a device becomes visible to the RealityWarden runtime.

It describes what a robot, robot arm, sensor, smart device, lab device, factory system, electronic toy, or future physical device can expose to AI workflows in a simulation-first boundary.

This is the ecosystem entry point: devices should not be hardcoded into one closed brand stack. Developers should be able to describe devices as packages, validate them locally, fix errors, and import them into RealityWarden.

It is not a marketplace, cloud service, account system, certified safety product, or live hardware layer.

## What Is a Reality Asset Package?

A Reality Asset Package is a JSON description of a device that RealityWarden can inspect and validate.

It contains:

- `assetId`
- `name`
- `version`
- `vendor`
- `description`
- `deviceManifest`
- `capabilityContracts`
- `worldModelAssumptions`
- `adapterBoundary`
- `examplePrompts`
- `validationRules`
- `supportLevel`
- `safetyNotes`
- `tags`

## Why Assets Exist

Physical AI should not require every company to rebuild a full closed AI-to-device stack.

Reality Assets let more companies and developers participate by describing:

- what the device is
- what it can do
- what it must not do
- which natural-language goals are supported
- which goals are unsafe or unsupported
- which capabilities require simulation or human approval
- which adapter boundary the device exposes

The current Public Alpha is simulation-first, but the asset shape is designed to support a future ecosystem of adapters, simulation packs, safety rules, audit workflows, and deployment services.

Devices should not be hardcoded into the runtime. A third-party developer should be able to describe a device as a package, validate it locally, fix errors, and then import it into RealityWarden.

## Create an Asset

Start from:

```text
examples/reality-assets/templates/basic-device.asset.json
```

Copy it, change the IDs, fill in the manifest, capabilities, prompts, and safety notes, then validate it locally.

## Capability Contracts

`capabilityContracts` describe what the device can do. They are not raw device instructions. They are contracts the runtime can reason about before any adapter boundary is reached.

## Natural-Language Goals Are Not Device Instructions

An AI model may produce a natural-language goal such as "move the cube," "turn on the light," or "take a photo."

RealityWarden translates that goal into an inspectable runtime path before it reaches any device boundary.

Natural language is not permission by itself.

## TaskDSL Is Not a Device Instruction

TaskDSL is an inspectable task representation. It is not a device instruction stream and must not be treated as direct device operation.

## Adapter Boundary

Every asset has an `adapterBoundary`.

For the current Public Alpha:

- `realAdapterEnabled` must be `false`
- `adapterMode` must be `simulation_only`, `read_only`, or `real_disabled`
- live device execution is not supported
- Coming Soon assets cannot be runnable

## Validate Locally

Run:

```bash
node scripts/validate-reality-asset.cjs examples/reality-assets/desktop_fan.asset.json
```

Valid assets exit with code `0`.

Invalid, unsafe, duplicate, or unsupported-schema assets exit with code `1`.

## Import Into RealityWarden

Open the Reality Asset Catalog in the app, paste the asset JSON into the import box, and import it.

Valid assets appear in the local in-memory catalog. Invalid or unsafe assets show validation errors and are not imported.

## Common Validation Errors

- `realAdapterEnabled must be false in Public Alpha`
- `deviceManifest is required`
- `capabilityContracts must contain at least one capability`
- `Coming Soon assets cannot be runnable`
- `safetyNotes must exist`
- `examplePrompts must include at least one prompt group`

## Current Boundary

This Developer Kit is simulation-first.

It does not support:

- live device execution
- production hardware use
- certified industrial safety
- cloud marketplace
- accounts
- payments
- claims that purely mechanical objects without electronics or interfaces can be changed by software alone