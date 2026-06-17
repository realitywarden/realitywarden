# OpenReality Device Format

`.openreality-device.json` packages one importable device asset for Open Reality Studio.

## Format

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

## Required Sections

- `asset_manifest`: asset id, display name, category, device type, license, brand, source, visual model, allowed use
- `device_meta`: Device Profile compatible metadata
- `geometry`: workspace, zones, scene geometry, camera
- `adapter_manifest`: simulator adapter command support
- `scenarios`: at least one safe scenario and one unsafe scenario
- `license`: license name and source

## License Rules

Assets without a license are rejected.
Assets without a source are rejected.
Brand must be one of:

- `generic`
- `user-owned`
- `vendor-authorized`

Built-in assets are generic industrial-style assets.
They do not use unauthorized brand logos, trademarks, or vendor CAD files.
Users may import their own licensed models.
