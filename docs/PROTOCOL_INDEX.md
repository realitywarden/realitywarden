# Protocol Documentation Index (authoritative)

Three documents describe protocol-related contracts. They overlap in history
but have distinct jobs. When they disagree, THIS index decides.

**Authoritative contract: [`OPEN_REALITY_PROTOCOL.md`](./OPEN_REALITY_PROTOCOL.md)**
— the public-facing protocol contract (protocolName, version, runtimeBoundary,
capability catalog, conformance rules). If any other document contradicts it,
`OPEN_REALITY_PROTOCOL.md` wins. Code-level source of truth:
`lib/open-reality-protocol/` and its tests.

**[`PROTOCOL.md`](./PROTOCOL.md)** — internal architecture overview: how the
protocol chain maps onto `lib/protocol/*` modules. Explains implementation,
does not define the contract. Historical sections may lag; defer to the
authoritative contract above.

**[`OPENREALITY_DEVICE_FORMAT.md`](./OPENREALITY_DEVICE_FORMAT.md)** — file
format spec for `.openreality-device.json` import packages only. Authoritative
for that file format, and only that.

Related but separate: `ADAPTER_SDK.md` / `ADAPTER_SDK_BOUNDARY.md` (adapter
SDK surface), `DEVICE_PROFILE.md` (profile structure),
`REAL_HARDWARE_ESP32.md` (real-hardware execution path).
