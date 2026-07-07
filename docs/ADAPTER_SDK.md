# Adapter SDK

## AdapterInterface

Every simulator adapter and future real-device adapter must implement:

```ts
connect(): Promise<void>
disconnect(): Promise<void>
getDeviceMeta(): Promise<DeviceMeta>
executeCommand(command: AdapterCommand): Promise<AdapterResult>
getState(): Promise<Record<string, unknown>>
stop(): Promise<AdapterResult>
emergencyStop(): Promise<AdapterResult>
```

This keeps the virtual lab and real hardware path aligned.

## SimulatorAdapter

`lib/virtual-lab/SimulatorAdapter.ts` implements `AdapterInterface` for `VirtualDeviceInstance`. It converts Task DSL steps into Adapter Commands, checks whether actions are supported by the selected Device Profile, applies state patches, and returns Adapter Results.

## RealDeviceAdapter

`lib/adapter/RealDeviceAdapter.ts` implements the same `AdapterInterface` as `SimulatorAdapter`. This is an experimental future real-device adapter boundary. It delegates hardware-specific IO to a `DeviceTransport`, which can represent serial, USB, network, ROS, PLC, or vendor SDK transport.

Safety Runtime still runs before execution, so the real adapter receives already-approved Adapter Commands.

This layer is not a production hardware control feature. It requires a certified adapter, verified DeviceTransport, and human supervision.

## DeviceTransport

`DeviceTransport` is the hardware boundary below `RealDeviceAdapter`:

```ts
open(): Promise<void>
close(): Promise<void>
send(command: AdapterCommand): Promise<AdapterResult>
readState(): Promise<Record<string, unknown>>
stop(): Promise<AdapterResult>
emergencyStop(): Promise<AdapterResult>
```

`MockDeviceTransport` is included for SDK-level adapter testing without hardware.

## AdapterCommand

`AdapterCommand` contains:

- command id
- source Task DSL step id
- action
- target
- payload
- allowed flag
- blocked reason when disallowed

## AdapterResult

`AdapterResult` contains:

- command id
- status: `ok`, `blocked`, or `failed`
- optional state patch
- message

## Developing A New Device Adapter

1. Create a Device Profile under `profiles/<device-id>/`.
2. Declare capabilities and constraints in `device.meta.json`.
3. Add geometry or stage hints in `geometry.json`.
4. Add safety rules in `safety.rules.ts`.
5. Implement `simulator.adapter.ts` or a real adapter using `RealDeviceAdapter` plus a `DeviceTransport`.
6. Add one safe and one unsafe scenario under `scenarios/`.
7. Run `npm run test:virtual-lab` and `npm run verify`.

## Protocol Intake Boundary

Before an adapter is treated as runnable, it should consume protocol artifacts instead of trusting UI state alone.

Minimal examples now exist under:

- `examples/protocol/openreality-protocol-v0.1.consumer-example.json`
- `examples/protocol/openreality-protocol-v0.1.adapter-intake.json`
- `examples/adapter-sdk/openreality-adapter-sdk-v0.1.intake-summary.json`
- `examples/adapter-sdk/simulation-adapter.stub.ts`

Regenerate them with:

```bash
npm run protocol:consume-example
npm run protocol:adapter-intake-example
npm run protocol:adapter-sdk-example
```

These examples show the intended gating rules:

1. accept only assets marked runnable in Public Alpha
2. require simulation runtime permission to be `allowed: true`
3. keep `real_device.execute` disabled
4. keep protocol-shaped but unsupported assets out of the main Run flow

This is the current SDK boundary: protocol assets may be inspectable for all devices, but adapter intake must remain stricter than protocol discovery.

The `simulation-adapter.stub.ts` example is intentionally narrow. It shows how to:

1. accept only the current Public Alpha runnable device types
2. reject protocol-only assets before adapter execution
3. preserve `allowed` / `blocked` command semantics
4. keep runtime mode explicitly simulation-only
