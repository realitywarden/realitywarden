# Device Asset Library

The Device Asset Library is the built-in industrial-style equipment library used by Open Reality Studio Desktop.

Built-in assets are generic industrial-style assets.
They do not use unauthorized brand logos, trademarks, or vendor CAD files.
Users may import their own licensed models.

## Why Realistic Industrial-style Assets

Open Reality Studio is a desktop simulator and virtual lab. The workspace should feel like an engineering tool, so built-in devices need recognizable industrial structure: robot bases, AGV chassis, PTZ camera heads, conveyor rollers, PLC cabinets, sensor housings, lab instruments, and warehouse racks.

These assets are generic. They are not digital twins of specific vendor products.

## Built-in Assets

- Generic Industrial Robot Arm
- Generic AGV Mobile Robot
- Generic PTZ Camera
- Generic Conveyor Belt
- Generic PLC Cabinet
- Generic Smart Light Panel
- Generic Lab Instrument
- Generic Warehouse Rack
- Generic Sensor Box

## Asset Package Structure

Each built-in asset contains:

```text
asset.manifest.json
device.meta.json
geometry.json
safety.rules.ts
adapter.manifest.json
scenarios/safe.json
scenarios/unsafe.json
README.md
```

## License Boundary

Every asset must declare a license. Built-in Open Reality Studio assets use:

```text
project-owned-generic
```

Official built-in assets must use:

```text
brand: generic
source: created-for-open-reality-studio
```

## Importing Licensed Models

Future imports support:

- `.glb`
- `.gltf`
- `.openreality-device.json`

Imported models must include a license field. Assets without a license cannot enter the official asset library.

## Asset Import Wizard

The desktop workbench includes an Asset Import Wizard:

1. Select `.glb`, `.gltf`, or `.openreality-device.json`.
2. Fill asset metadata: asset id, display name, category, device type, manufacturer/model, license, source, and allowed use.
3. Bind or review Device Profile data: `device.meta.json`, `geometry.json`, `safety.rules.ts`, and `adapter.manifest.json`.
4. Run License Review.
5. Preview the 3D model or procedural fallback.
6. Import the asset into the Device Library and add it to the Workspace.

`.step` and `.urdf` are not supported yet. They remain future import routes.

## License Review Rules

- Empty license is rejected.
- Empty source is rejected.
- Brand must be `generic`, `user-owned`, or `vendor-authorized`.
- Non-generic built-in assets are rejected.
- Vendor-authorized assets require future certification metadata before they can become certified vendor assets.

## .openreality-device.json

See `docs/OPENREALITY_DEVICE_FORMAT.md`.

The package contains:

```json
{
  "asset_manifest": {},
  "device_meta": {},
  "geometry": {},
  "adapter_manifest": {},
  "scenarios": [],
  "license": {}
}
```

## GLB / GLTF Import

GLB and GLTF imports are previewed in the Asset Import Wizard. The imported asset still requires a license and source. If profile metadata is incomplete, Open Reality Studio uses a procedural fallback profile until the user binds a complete `.openreality-device.json` package.

## Workspace Registration

Imported assets enter the runtime Device Library. From there, users can add them to the Workspace, inspect license/source data, and export project files.

## Community Assets

Community assets should include:

- manifest
- license
- source attribution
- device meta
- geometry
- safe and unsafe scenarios
- adapter manifest
- README

They must pass asset conformance tests before being treated as trusted library assets.

## Asset Conformance Test

Run:

```bash
npm run test:assets
```

The test verifies manifests, metadata, geometry, scenarios, licenses, generic branding, fallback visuals, and registry coverage.

## Certified Vendor Assets

Future certified vendor assets may use vendor-approved CAD or digital twin data only when the vendor provides explicit licensing and certification metadata. Those assets will be separate from the generic built-in library.
