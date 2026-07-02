# Open Reality Studio

## AI should not touch reality directly.

Open Reality Studio is the safety and accountability layer between AI agents and real-world devices.

AI is moving from code into robots, drones, labs, factories, smart devices, and physical systems. Open Reality checks goals, device capabilities, world state, simulation results, safety decisions, and audit evidence before AI is allowed to act.

**Status:** Public Alpha · Simulation-first · Real device execution disabled by default

No hardware required.

Same protocol for simulation and future real devices.

**Demo video:** [Watch the Robot Arm Golden Path demo](https://github.com/ZqiEE/open-reality-studio/releases/download/v0.1-public-alpha/open-reality-robotarm-demo-release-cut-web.mp4)

## What it does now

- **Simulation-first Public Alpha** for local Physical AI workflows.
- **Runtime Kernel** for goal parsing, capability checks, planning, and safety decisions.
- **Reality Assets** for describing device capabilities, safety boundaries, adapter modes, and example prompts.
- **Asset import and validation** for inspecting third-party device packages before they enter the workspace.
- **Safety Governor** blocks unsafe, unsupported, ambiguous, or not-runnable requests before simulation dispatch.
- **Audit-ready logs** record what was requested, what was checked, what was allowed or blocked, and why.
- **Real device execution disabled by default**. No production hardware control is exposed in this alpha.

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

## Why this matters

AI agents are leaving chat boxes and starting to reach for physical systems. Direct control is dangerous.

Robots, drones, labs, factories, smart devices, and physical infrastructure need a runtime boundary that checks:

- what the AI is trying to do
- whether the target device can actually do it
- whether the world state makes the action safe
- whether simulation says the action is valid
- whether the decision is reviewable later

Open Reality Studio is the local desktop prototype for that boundary. It is not a hardware controller yet. It is a simulation-first safety and accountability layer.

## Try it

Clone and install:

```bash
git clone https://github.com/ZqiEE/open-reality-studio.git
cd open-reality-studio
npm install
```

Run web mode:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run desktop mode:

```bash
npm run desktop:dev
```

Build and verify:

```bash
npm run typecheck
npm run build
npm run verify
```

## Demo prompts

Copy one of these into **AI Command**:

```text
Move the red cube to the back safe zone
```

```text
Throw the red cube off the table
```

```text
Set the light to blue
```

Expected behavior:

- safe robot-arm requests simulate the action
- unsafe robot-arm requests are blocked before execution
- low-risk light and camera requests run as limited simulation paths
- Coming Soon devices do not silently fall back to another device

## Current boundary

This repository is currently a **simulation-first Public Alpha**.

- No production hardware control.
- No real device execution by default.
- No certified industrial safety guarantee.
- Not all device families are runnable.
- Coming Soon devices must not silently fall back to another device.
- Future real device adapters must remain behind explicit safety and adapter boundaries.

## Who this is for

- AI builders designing agent-to-device workflows
- robotics developers testing command and safety flows
- labs validating procedures before touching equipment
- hardware teams packaging device capabilities as Reality Assets
- deployment operators checking simulation and audit outputs
- safety reviewers who need to understand why a request was allowed or blocked

## First-run workflow

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

## Submit a Reality Asset

Open Reality Studio now accepts community Reality Asset drafts.

Describe a robot, drone, lab device, smart device, or physical AI system as a Reality Asset.

Community assets are:

- simulation-only by default
- unverified by default
- descriptive only
- not real adapter code
- not real hardware execution

Start with:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [SECURITY.md](./SECURITY.md)
- [Community Reality Asset Drafts](./examples/community-assets/README.md)

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
