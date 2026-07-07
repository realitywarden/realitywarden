# Simulator Architecture

RealityWarden uses a semantic simulator architecture. The simulator is not a visual toy layer; it is the virtual execution boundary used to validate AI-controlled device behavior before real hardware is considered.

## Runtime Chain

```text
Task DSL
-> Safety Runtime
-> AdapterCommandCompiler
-> SimulatorAdapter
-> VirtualDeviceInstance
-> State Snapshot
-> Lab Report
```

## Virtual Device Runtime

The Virtual Device Runtime owns:

- device registry
- device instance creation
- simulator adapter execution
- scenario running
- state before/after capture
- timeline snapshots
- lab report generation

## State Snapshots

Every execution step records a state snapshot. Timeline replay uses snapshots to reconstruct the scene at a specific step. It does not re-execute commands during replay.

Blocked runs preserve the state before the unsafe command. This keeps the blocked scene inspectable and prevents hidden state mutation.

## Workspace Devices

The desktop workspace can hold multiple devices. Each workspace device has:

- device type
- profile id
- selected model asset
- adapter target id
- enabled state
- speed limit
- force limit
- forbidden zones

Workspace Validation executes safe validation scenarios for all enabled devices and records per-device results.

## Adapter-ready Command Output

The simulator emits adapter-ready commands. The command shape is designed so future certified adapters can consume the same validated command output after Safety Runtime approval.

## Fidelity Levels

Current virtual devices support semantic and kinematic-level visualization. Industrial rigid-body physics, torque curves, contact dynamics, and sensor noise are future simulator fidelity layers, not current claims.
