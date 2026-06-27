# Open Reality Protocol v0.1

Open Reality Protocol is the public-facing contract layer for Open Reality Studio.

It sits above device-specific simulation details and below product UI. Its job is to make the runtime boundary inspectable, stable, and reusable before any future real-device execution exists.

## Current Boundary

- `protocolName`: `Open Reality Protocol`
- `version`: `0.1`
- `runtimeBoundary`: `simulation_first`
- `realDeviceExecution`: `false`

This protocol does **not** enable real hardware. It defines the contract that future simulator and adapter implementations must share.

## Contract Surface

The `v0.1` code contract lives in:

- `lib/open-reality-protocol/contracts.ts`
- `lib/open-reality-protocol/ProtocolSpec.ts`
- `lib/open-reality-protocol/index.ts`

The protocol reuses and stabilizes the core runtime concepts that already exist in the Runtime Kernel:

- `DeviceManifest`
- `CapabilityContract`
- `WorldModel`
- `Goal`
- `Plan`
- `SafetyEnvelope`
- `TaskDSL`
- `ExecutionPermission`
- `SupportLevel`
- `AdapterBoundary`

## Important Rules

### TaskDSL is not a device command

`TaskDSL` is an audited intermediate contract. It is not a hardware command stream and it is not permission to control a real device.

### Simulation-first only

The current protocol allows only:

- `simulation_only`
- `read_only`
- `ask_human`
- `blocked`

It does **not** include `real_execution`.

### Real devices must stay behind Adapter Boundary

Future hardware work must enter through an explicit adapter boundary.

That means:

- future real devices must still consume protocol-shaped tasks
- local safety enforcement must still run first
- `realDeviceExecution` remains `false` in `v0.1`

## Public Alpha Runnable Boundary

At protocol level, only these support levels are runnable:

- `simulation_only`
- `read_only`

That currently maps to:

- `robot_arm`
- `smart_light`
- `camera_sensor`

These remain non-runnable at protocol level in `v0.1`:

- `mobile_robot`
- `conveyor_belt`
- `plc_cabinet`
- `lab_instrument`
- `warehouse_rack`
- `sensor_box`
- `drone_unit`

## Why this exists

Before `v0.2`, the project had a runtime and product UI, but the external contract was still implicit.

This protocol layer makes the public boundary explicit:

- what the runtime understands
- what can be executed in simulation
- what stays blocked
- what future adapters will need to consume

## Validation

Run:

```bash
npm run test:protocol
```

This verifies:

- protocol version is `0.1`
- `realDeviceExecution` is `false`
- required contracts are exported
- execution modes do not include `real_execution`
- protocol exports are consumable after compilation
- Coming Soon devices are not marked runnable
