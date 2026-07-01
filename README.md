# Open Reality Studio Desktop

Open Reality Studio is a simulation-first desktop runtime for Physical AI workflows.

AI should not touch the physical world directly. Open Reality lets AI understand goals, check device capabilities, simulate actions, and block unsafe commands before anything reaches reality.

No hardware required.

Same protocol for simulation and future real devices.

Status: **Public Alpha** · **Simulation-first** · **No real device execution yet** · **Runtime Kernel** · **Reality Asset Platform** · **Developer Kit**

Robot Arm demo video: https://github.com/ZqiEE/open-reality-studio/releases/download/v0.1-public-alpha/open-reality-robotarm-demo-release-cut-web.mp4

## What You Can See Now

- Safe command executes in simulation.
- Unsafe command gets blocked before execution.
- Unsupported or Coming Soon devices do not silently fall back to another device.

Runnable simulation paths are intentionally narrow:

| Device Type | Main Run | Notes |
| --- | --- | --- |
| `robot_arm` | Yes | Golden-path autonomy + playback demo |
| `smart_light` | Yes | Limited low-risk natural-language simulation run |
| `camera_sensor` | Yes | Limited low-risk natural-language simulation run |
| `mobile_robot` | No | Coming Soon |
| `conveyor_belt` | No | Coming Soon |
| `plc_cabinet` | No | Coming Soon |
| `lab_instrument` | No | Coming Soon |
| `warehouse_rack` | No | Coming Soon |
| `sensor_box` | No | Coming Soon |

See [docs/DEVICE_SUPPORT.md](./docs/DEVICE_SUPPORT.md) for the exact support matrix.

## Why This Matters

AI agents are moving from chat boxes into the physical world. Direct control is dangerous: devices need manifests, capability contracts, safety governors, simulation, and audit logs before commands can reach real hardware.

Open Reality is building that runtime layer. The current alpha is local, desktop-first, and simulation-only.

## Quick Start

Install dependencies:

```bash
npm install
```

Run web development mode:

```bash
npm run dev
```

Run the desktop shell in development mode:

```bash
npm run desktop:dev
```

Build and verify:

```bash
npm run typecheck
npm run build
npm run verify
```

First-run workflow:

1. Stay on `robot_arm`, `smart_light`, or `camera_sensor`.
2. Add or select the workspace device you want to run.
3. Enter a task in **AI Command** below the workspace.
4. Watch the simulation, blocked state, inspector, and bottom console.
5. Remember: real device execution is not enabled.

For a structured trial, see [docs/EVALUATION_GUIDE.md](./docs/EVALUATION_GUIDE.md) and [docs/WINDOWS_TRIAL_GUIDE.md](./docs/WINDOWS_TRIAL_GUIDE.md).

## Reality Asset Developer Kit

Reality Assets describe devices as inspectable packages:

- Device Manifest
- Capability Contract
- World Model assumptions
- Adapter Boundary
- Example Prompts
- Validation Rules

Validate a local asset package:

```bash
npm run validate:reality-asset -- examples/reality-assets/templates/basic-device.asset.json
```

Start here:

- [Reality Asset Developer Kit](./docs/REALITY_ASSET_DEVELOPER_KIT.md)
- [Reality Asset Submission Guide](./docs/REALITY_ASSET_SUBMISSION.md)

## Contribute

- Star the repo if the Physical AI runtime direction is useful.
- Try the demo and report where the workflow is unclear.
- Submit a Reality Asset idea.
- Open a device support request.
- Build a third-party simulation-only Reality Asset Package.

Use the GitHub issue templates for bugs, Reality Asset ideas, and device support requests.

## Public Alpha Boundaries

This repository is currently a **simulation-only Public Alpha**.

- No real device execution.
- No production hardware control.
- No certified industrial safety guarantee.
- Not all device families are runnable.
- Coming Soon devices must not silently fall back to another device.
- Future real device adapters must remain behind explicit safety and adapter boundaries.

## Open Reality Protocol v0.1

The stable `v0.2` contract layer now lives under `lib/open-reality-protocol`.

It reuses the Runtime Kernel contracts and makes the public protocol boundary explicit:

- `DeviceManifest`
- `CapabilityContract`
- `WorldModel`
- `Goal`
- `Plan`
- `SafetyEnvelope`
- `TaskDSL`
- `AdapterBoundary`

See [docs/OPEN_REALITY_PROTOCOL.md](./docs/OPEN_REALITY_PROTOCOL.md).

## What This Alpha Does

- Runs a desktop virtual lab UI
- Compiles prompts into safe simulated execution flows
- Shows command-driven virtual-device playback
- Runs Safety Runtime before simulated execution
- Produces adapter commands, execution timeline, and Lab Report
- Supports project/workspace state inside the desktop workbench
- Can be packaged into a Windows desktop installer from the repository source tree

## What This Alpha Does Not Do

- No real device execution
- No production hardware control
- No certified industrial safety guarantee
- No cloud runtime
- No marketplace
- No LocalRuntime / EdgeRuntime for real hardware yet

## Additional Commands

Run the production shell from source after a production build:

```bash
npm run desktop:prod
```

Run a non-interactive desktop production smoke check:

```bash
npm run desktop:smoke
```

Create a Windows desktop installer:

```bash
npm run desktop:pack
```

The installer is written to:

```text
release/Open-Reality-Studio-<version>-Setup.exe
```

For the current Public Alpha build, the packaged installer path is:

```text
release/Open-Reality-Studio-0.1.1-Setup.exe
```

`npm run desktop:start` is a convenience script for local development. For repeatable evaluation, use `desktop:dev` or `desktop:prod` explicitly.

Build the app:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run verification:

```bash
npm run verify
```

Run protocol validation:

```bash
npm run test:protocol
```

## Execution Model

Simulation path:

```text
Prompt
-> Device Profile
-> Task DSL
-> Safety Runtime
-> Adapter Commands
-> Virtual Device Runtime
-> Lab Report
```

For `robot_arm`, the main path also includes the current `AutonomyCore` / `RiskJudge` chain before simulated execution.

## Natural Language Boundary

Natural-language support is not universal.

- `robot_arm` supports the current golden-path AI command flow.
- `smart_light` supports a limited set of low-risk Chinese/English prompts.
- `camera_sensor` supports a limited set of low-risk Chinese/English prompts.
- Unsupported prompts must fail clearly and must not silently fall back into execution.

## Asset Boundary

Built-in assets are **generic industrial-style assets**.

They do **not** use unauthorized vendor logos, trademarks, or vendor CAD files.

## Future Real Device Adapter Boundary

The repository keeps future-facing adapter abstractions, but **real device execution is not part of this Public Alpha**.

Future real-device work must remain behind:

- certified adapters
- verified transport
- local safety enforcement
- human supervision

## Docs

- [docs/EVALUATION_GUIDE.md](./docs/EVALUATION_GUIDE.md)
- [docs/WINDOWS_TRIAL_GUIDE.md](./docs/WINDOWS_TRIAL_GUIDE.md)
- [docs/DEVICE_SUPPORT.md](./docs/DEVICE_SUPPORT.md)
- [docs/DEVICE_ONBOARDING.md](./docs/DEVICE_ONBOARDING.md)
- [docs/OPEN_REALITY_PROTOCOL.md](./docs/OPEN_REALITY_PROTOCOL.md)
- [docs/PROTOCOL.md](./docs/PROTOCOL.md)
- [docs/COMMERCIAL_POSITIONING.md](./docs/COMMERCIAL_POSITIONING.md)
- [docs/CUSTOMER_VALIDATION.md](./docs/CUSTOMER_VALIDATION.md)
- [docs/RELEASE_NOTES_V0.2_ALPHA.md](./docs/RELEASE_NOTES_V0.2_ALPHA.md)
- [docs/RELEASE_READINESS_V0.2_ALPHA.md](./docs/RELEASE_READINESS_V0.2_ALPHA.md)
- [docs/FIRST_LOW_RISK_REAL_DEVICE_PLAN.md](./docs/FIRST_LOW_RISK_REAL_DEVICE_PLAN.md)
- [docs/SOCIAL_MEDIA_LAUNCH_PACK.md](./docs/SOCIAL_MEDIA_LAUNCH_PACK.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)
- [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md)
- [docs/VIRTUAL_LAB.md](./docs/VIRTUAL_LAB.md)
- [docs/DEVICE_ACTION_RUNTIME.md](./docs/DEVICE_ACTION_RUNTIME.md)
- [docs/ADAPTER_SDK.md](./docs/ADAPTER_SDK.md)
