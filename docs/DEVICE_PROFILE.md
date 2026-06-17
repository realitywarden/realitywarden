# Device Profile

A Device Profile is a portable device description. It lets a vendor, developer, or certified engineer describe a device without changing Open Reality source code.

Each profile has three required files:

```text
device.meta.json
geometry.json
safety.rules.ts
```

## 1. Create A Directory

Create a profile folder under `profiles/`:

```text
profiles/my-device-profile/
```

Use a lowercase id with hyphens. The folder name should match `profile_id`.

## 2. Write device.meta.json

`device.meta.json` describes identity, capabilities, adapters, risk class, constraints, and safety profile.

Required fields include:

- `profile_id`
- `profile_version`
- `manufacturer`
- `model`
- `device_type`
- `risk_class`
- `simulator_profile`
- `supported_adapters`
- `capabilities`
- `constraints`
- `safety_profile`

The Safety Runtime reads this file to decide which actions, speeds, forces, zones, and risk levels are allowed.

## 3. Write geometry.json

`geometry.json` describes how the simulator should display the device.

It includes:

- table size
- robot base position
- arm segment lengths
- gripper size
- object positions
- safe zone positions
- forbidden zone positions
- workspace bounds
- camera default position

The semantic simulator reads this file to build the scene. It is not a physics engine.

## 4. Write safety.rules.ts

`safety.rules.ts` documents profile-specific safety behavior. It should match the fields in `device.meta.json`.

It should declare:

- blocked actions
- blocked targets
- blocked zones
- speed policy
- force policy
- medium/high risk policy
- logging expectations

## 5. Run Conformance Test

Run:

```bash
npm run test:conformance
```

For the current Alpha, conformance checks that profile metadata and geometry are valid, safety rules exist, dangerous tasks are blocked, and export JSON includes profile and dry run fields.

## 6. Compatible Profile

A profile can be called compatible only after:

- `device.meta.json` passes schema validation
- `geometry.json` passes schema validation
- `safety.rules.ts` exists
- dangerous tasks are blocked
- dry run results are included in execution reports
- `npm run verify` passes
