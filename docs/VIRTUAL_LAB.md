# Open Reality Studio Virtual Lab

## What Open Reality Studio Is

Open Reality Studio is a development platform for AI-controlled devices. It lets developers build, simulate, test, debug, and validate device behavior before touching real hardware.

The Virtual Lab is the current main product. Developers should create Device Profiles, write scenarios, inspect generated Task DSL, debug Safety Runtime results, review Adapter Commands, and export Lab Reports in the Virtual Lab before any real device work.

The core chain is:

```text
Prompt -> Device Profile -> Task DSL -> Safety Runtime -> Virtual Device Runtime -> Adapter -> Device -> Lab Report
```

## Why Virtual Lab Is Needed

AI systems should not directly operate physical devices. A virtual lab gives teams a repeatable place to validate intent, generated task source, safety rules, adapter commands, state changes, and audit output before any real actuator, sensor, robot, or machine is involved.

## Why Contributors Do Not Need Real Hardware

Contributors can add and test devices by providing a profile, geometry, safety rules, simulator adapter entry, and scenarios. The Virtual Device Runtime uses those files to create a virtual device instance and run the same Safety Runtime and AdapterInterface that a real adapter would use.

## Virtual Device And Real Device Relationship

A Virtual Device is a software implementation of a Device Profile. A Real Device is hardware reached through a RealDeviceAdapter. Both share:

- Device Profile
- Task DSL
- Safety Runtime
- AdapterInterface
- AdapterCommand
- AdapterResult

RealDeviceAdapter is only a future real-device adapter boundary at this stage. It exists so the SDK can preserve the same protocol for future hardware work, but the current Studio workflow should remain Virtual Lab first.

## Device Profile Drives The Virtual Device

`device.meta.json` declares device type, capabilities, constraints, risk class, forbidden zones, known targets, and supported adapters. `geometry.json` provides enough stage information for the virtual lab to render and reason about the device.

## Simulator Fidelity

Every virtual profile declares `simulator_fidelity`. The current profiles are semantic simulators: they validate Task DSL, Safety Runtime behavior, Adapter Commands, and state transitions. They do not claim high-fidelity physics such as torque, inertia, photometrics, wheel slip, optics, or motor load.

This turns simulation scope into an auditable contract instead of an implicit assumption. Higher-fidelity profiles can later declare `kinematic` or `physics` and expand the `validates` list.

## SimulatorAdapter And RealDeviceAdapter

`SimulatorAdapter` implements `AdapterInterface` against `VirtualDeviceInstance`. `RealDeviceAdapter` implements the same interface as an experimental future transport boundary and delegates hardware IO to `DeviceTransport`, which could later wrap serial, network, USB, ROS, PLC, or vendor SDKs.

Real-device execution is not the current main path. Production hardware requires certified adapters, verified DeviceTransport implementations, and human supervision.

```text
connect()
disconnect()
getDeviceMeta()
executeCommand(command)
getState()
stop()
emergencyStop()
```

## Scenario Runner

The Scenario Runner loads a Device Profile and a Device Scenario, compiles the prompt into Task DSL, runs Safety Runtime, creates Adapter Commands, executes allowed commands through the SimulatorAdapter, and emits a Lab Report.

Unsafe scenarios must be blocked before adapter execution. Safe scenarios must update virtual device state.

Current contributors should validate behavior in the Virtual Lab first. Real-device adapters should be developed only after the Device Profile, Task DSL, Safety Runtime behavior, Adapter Commands, state transitions, and Lab Report all pass virtual scenarios and conformance tests.

## Lab Report For Auditability

Lab Reports are structured evidence for review, QA, and enterprise trust. They include the prompt, selected profile, Task DSL, safety report, adapter commands, state before and after, execution timeline, and final result.
