# RealityWarden Protocol

> Role: internal architecture overview. The authoritative protocol contract is [`OPEN_REALITY_PROTOCOL.md`](./OPEN_REALITY_PROTOCOL.md) — see [`PROTOCOL_INDEX.md`](./PROTOCOL_INDEX.md).

This document describes the protocol chain used by RealityWarden.

This is no longer only a concept page. The repository now has a first code-level protocol layer in:

- `lib/protocol/OpenRealityProtocol.ts`
- `lib/protocol/DeviceManifest.ts`
- `lib/protocol/RealityAsset.ts`
- `lib/protocol/ComponentGraph.ts`
- `lib/protocol/CapabilityNormalizer.ts`
- `lib/protocol/SafetyProfile.ts`
- `lib/protocol/RuntimePermission.ts`
- `lib/protocol/AdapterBinding.ts`

RealityWarden is a desktop Virtual Lab for AI-controlled devices. Its current product path is virtual development, testing, debugging, replay, validation, and audit before touching real hardware.

## Protocol Chain

```text
Prompt
-> Device Profile
-> Task DSL
-> Safety Runtime
-> Virtual Device Runtime
-> Simulator Adapter
-> Virtual Device
-> Lab Report
```

Future real-device execution uses the same upper layers:

```text
Prompt
-> Device Profile
-> Task DSL
-> Safety Runtime
-> Real Device Adapter
-> Real Device
-> Execution Report
```

The simulator and future real devices must share Device Profile, Task DSL, Safety Runtime, and Adapter Interface.

In `v0.1`, the protocol layer is still simulation-first. It does not expose production real-device execution. Its job is to make assets and device capabilities protocol-shaped and verifiable before deeper runtime work lands.

## Exportable Protocol Artifact

The protocol layer is now exportable as a concrete JSON catalog instead of remaining only as source code and tests.

Run:

```bash
npm run protocol:export
npm run protocol:consume-example
npm run protocol:adapter-intake-example
```

This writes:

```text
examples/protocol/openreality-protocol-v0.1.catalog.json
examples/protocol/openreality-protocol-v0.1.runnable.json
examples/protocol/openreality-protocol-v0.1.support-matrix.json
```

The exported catalog is a repository-tracked example artifact for developers and reviewers. It shows how built-in device assets become inspectable `RealityAsset` objects with:

- `manifest`
- `component_graph`
- `normalized_capabilities`
- `safety_profile`
- `runtime_permissions`
- `adapter_binding`

This does not execute hardware. It makes the protocol boundary concrete and reviewable.

The runnable subset and support matrix make the current Public Alpha boundary explicit:

- full catalog: all protocol-shaped built-in assets
- runnable subset: only `robot_arm`, `smart_light`, `camera_sensor`
- support matrix: consumer-facing view of runnable vs non-runnable protocol assets
- consumer example: intake decisions a future runtime or adapter layer can make without touching product UI code
- adapter intake example: a minimal SDK-boundary example showing how simulation adapter binding is accepted and non-runnable assets remain protocol-only

## Device Profile

A Device Profile is the standard device contract. It tells the compiler and runtime:

- device type
- capabilities
- model asset
- runtime state schema
- workspace bounds
- forbidden zones
- speed and force constraints
- supported adapters
- simulator fidelity

The profile drives both the virtual device and the adapter-ready command output.

At protocol level this becomes `DeviceManifest`, which is the normalized product-facing device contract derived from asset manifests and device meta.

## Task DSL

Task DSL is inspectable device task source. The compiler converts a prompt into structured steps such as `move_to_pose`, `navigate_to`, `set_light`, `capture_frame`, or `sort_item`.

Task DSL is intentionally not device execution. It is a validated intermediate representation that Safety Runtime can inspect before an adapter receives commands.

## Safety Runtime

Safety Runtime receives Device Profile and Task DSL, validates the task, and decides whether adapter execution is allowed.

It checks:

- action support
- target existence
- workspace boundaries
- forbidden zones
- speed limits
- force limits
- prohibited actions
- risk level
- logging requirements

Unsafe actions must be blocked before adapter execution.

## Adapter Interface

All adapters implement the same interface:

```text
connect()
disconnect()
getDeviceMeta()
executeCommand(command)
getState()
stop()
emergencyStop()
```

`SimulatorAdapter` implements this interface for virtual devices. `RealDeviceAdapter` remains a future/experimental boundary and is not the main UI path.

At protocol level this becomes `AdapterBinding`, which records which adapter interface and transport a Reality Asset is allowed to use.

## Reality Asset

A `RealityAsset` is the protocol-level packaging of:

- device manifest
- component graph
- normalized capabilities
- safety profile
- runtime permissions
- adapter binding
- source license metadata

This is the first code-level bridge between today's built-in virtual assets and tomorrow's protocol-based device onboarding.

## Component Graph

`ComponentGraph` expresses what a device contains and what it can target:

- workspace
- device root
- zones
- scene objects
- stage nodes
- indicators

This is intentionally lighter than a full digital twin. The goal in `v0.1` is inspectable structure, not industrial physics.

## Capability Normalization

Raw device commands such as `move_to_pose`, `set_light`, `capture_frame`, `read_register`, or `start_belt` are normalized into protocol-level capability descriptors.

This is the first step toward a future `CapabilityNormalizer` moat:

- common names
- capability classes
- target/value requirements
- risk hints
- device-family mapping

## Runtime Permission

`RuntimePermission` encodes an important current truth:

- simulation run may be allowed
- audit/export may be allowed
- real device connect/execute is still disabled in Public Alpha

This keeps the protocol layer honest about what is and is not actually runnable.

## Lab Report

Each run produces a Lab Report containing:

- lab run id
- device profile
- scenario
- prompt
- Task DSL
- safety report
- adapter commands
- device state before
- device state after
- execution timeline
- state snapshots
- result

The report is the audit record for developers, reviewers, and future deployment certification.

## Validation Path

Run:

```bash
npm run verify
```

This verifies type safety, production build, conformance checks, simulation tests, and virtual lab tests.

Protocol-only validation:

```bash
npm run test:protocol
```
