# Adapter SDK

## AdapterInterface

Every simulator adapter implements:

```ts
connect(): Promise<void>
disconnect(): Promise<void>
getDeviceMeta(): Promise<DeviceMeta>
executeCommand(command: AdapterCommand): Promise<AdapterResult>
getState(): Promise<Record<string, unknown>>
stop(): Promise<AdapterResult>
emergencyStop(): Promise<AdapterResult>
```

This is the virtual-lab adapter contract. Real hardware intentionally uses a
separate, stricter ticketed boundary described below.

## SimulatorAdapter

`lib/virtual-lab/SimulatorAdapter.ts` implements `AdapterInterface` for `VirtualDeviceInstance`. It converts Task DSL steps into Adapter Commands, checks whether actions are supported by the selected Device Profile, applies state patches, and returns Adapter Results.

## Real Hardware Boundary

Real hardware uses `lib/hardware/`: `HardwareExecutionGate` is the only issuer
of the private actuation ticket, `Esp32DeviceAdapter` requires that ticket, and
`RealDeviceTransport` separates read-only `send()` from ticketed
`sendActuation()`. This preserves honest `signalSent` evidence and prevents a
generic adapter reference from bypassing the safety gate.

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
5. Implement `simulator.adapter.ts`. Hardware integrations must follow the ticketed `lib/hardware/` boundary and its dedicated safety tests.
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
