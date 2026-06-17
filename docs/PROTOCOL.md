# Open Reality Studio Protocol

This document describes the protocol chain used by Open Reality Studio.

Open Reality Studio is a desktop Virtual Lab for AI-controlled devices. Its current product path is virtual development, testing, debugging, replay, validation, and audit before touching real hardware.

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
