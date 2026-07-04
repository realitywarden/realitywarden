# Build a Reality Asset in 10 Minutes

This guide shows the intended developer entry point for the Open Reality ecosystem.

A Reality Asset is a small device package that tells Open Reality what a device is, what it can do, what it must not do, which natural-language goals are supported, and which adapter boundary it exposes.

Current boundary: simulation-first. This guide does not enable live device operation.

## 1. Pick a Device Category

Start with a low-risk simulation-first or read-only device category:

- robot arm
- smart light
- camera sensor
- generic sensor
- electronic toy
- lab device proposal
- factory device proposal
- smart home device proposal

For the current Public Alpha, unsupported or future devices should remain `coming_soon` or `real_disabled`.

## 2. Copy the Template

Start from:

```text
examples/reality-assets/templates/basic-device.asset.json
```

Copy it to a new file, for example:

```text
examples/reality-assets/my_device.asset.json
```

## 3. Fill Device Identity

Update:

- `assetId`
- `name`
- `version`
- `vendor`
- `description`
- `deviceType`
- `supportLevel`
- `tags`

The goal is to make the device understandable to the runtime and to future developers.

## 4. Define Capabilities

Capabilities describe what the device can do.

They are not raw device instructions.

Examples:

- `move_object`
- `set_light_color`
- `read_sensor`
- `capture_image`
- `rotate_joint`
- `report_status`

For each capability, describe:

- inputs
- outputs
- preconditions
- effects
- risk level
- whether simulation is required
- whether human approval is required

## 5. Add Natural-Language Prompts

Add example prompts so the runtime and contributors understand how AI goals may map to the device.

Use groups such as:

- supported
- unsupported
- unsafe
- ambiguous

Example:

```json
{
  "supported": ["set the light to blue"],
  "unsupported": ["control a real device directly"],
  "unsafe": ["bypass safety checks"],
  "ambiguous": ["start"]
}
```

## 6. Define the Adapter Boundary

Every Reality Asset needs an adapter boundary.

For Public Alpha:

```json
{
  "simulationAdapterAvailable": false,
  "readOnlyAdapterAvailable": false,
  "realAdapterEnabled": false,
  "adapterMode": "real_disabled",
  "taskDslIsHardwareCommand": false
}
```

The important rule is simple:

Natural language is not direct device permission.

TaskDSL is not a device instruction stream.

Open Reality routes actions through a simulation-first runtime boundary.

## 7. Add Safety Notes

Explain what the device must not do.

Good notes answer:

- what is unsafe?
- what is unsupported?
- what should require simulation?
- what should require human approval?
- what should stay blocked?

## 8. Validate Locally

Run:

```bash
node scripts/validate-reality-asset.cjs examples/reality-assets/my_device.asset.json
```

A valid asset exits with code `0`.

An invalid asset exits with code `1` and reports what needs to be fixed.

## 9. Import Into Open Reality Studio

Open the Reality Asset Catalog in the app.

Paste the asset JSON into the import box.

Valid assets appear in the local in-memory catalog.

Invalid assets show validation errors.

## 10. Ecosystem Direction

Reality Assets are the first step toward a wider Physical AI ecosystem:

- hardware companies can expose devices
- developers can build adapters
- simulator builders can create simulation packs
- safety teams can define rules
- integrators can build deployment workflows
- operators can review audit logs

The goal is not one closed brand stack.

The goal is a common software boundary for AI-controlled physical devices.