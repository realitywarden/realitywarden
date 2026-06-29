# Reality Asset Developer Kit

The Reality Asset Developer Kit is the local path for creating and validating device asset packages before they enter Open Reality Studio.

It is not a marketplace, cloud service, account system, or real device execution layer.

## What Is a Reality Asset Package?

A Reality Asset Package is a JSON description of a device that Open Reality can inspect and validate.

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

Devices should not be hardcoded into the runtime. A third-party developer should be able to describe a device as a package, validate it locally, fix errors, and then import it into Open Reality Studio.

## Create an Asset

Start from:

```text
examples/reality-assets/templates/basic-device.asset.json
```

Copy it, change the IDs, fill in the manifest, capabilities, prompts, and safety notes, then validate it locally.

## Capability Contracts

`capabilityContracts` describe what the device can do. They are not raw device commands. They are contracts the runtime can reason about before any adapter boundary is reached.

## TaskDSL Is Not a Hardware Command

TaskDSL is an inspectable task representation. It is not a hardware command and must not be treated as direct device control.

## Adapter Boundary

Every asset has an `adapterBoundary`.

For the current Public Alpha:

- `realAdapterEnabled` must be `false`
- `adapterMode` must be `simulation_only`, `read_only`, or `real_disabled`
- real device execution is not supported
- Coming Soon assets cannot be runnable

## Validate Locally

Run:

```bash
node scripts/validate-reality-asset.cjs examples/reality-assets/desktop_fan.asset.json
```

Valid assets exit with code `0`.

Invalid, unsafe, duplicate, or unsupported-schema assets exit with code `1`.

## Import Into Open Reality Studio

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

- real device execution
- production hardware control
- certified industrial safety
- cloud marketplace
- accounts
- payments
