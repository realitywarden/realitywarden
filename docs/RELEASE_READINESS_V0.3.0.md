# RealityWarden v0.3.0 Public Alpha Release Readiness

This report records software and packaging readiness. It does not create a tag,
push a branch, sign binaries, publish a release, or claim production readiness.

## Decision

Status: **software release candidate ready**

The v0.3.0 repository and versioned Windows installer are internally consistent
for a manual Public Alpha release decision. Physical reference-kit testing
remains optional field evidence and is not a development or release-engineering
prerequisite.

## Readiness gates

### Product boundary — pass

- AI Command Terminal remains the default simulation workflow.
- REAL HARDWARE is visually separate and limited to the reference rig.
- Evidence lock, operator confirmation, default-block interlocks, private ticket
  path, and explicit `real_hardware` labeling remain intact.
- Unsupported devices remain Coming Soon/non-runnable.

### Safety evidence — pass

- real-hardware invariant suite: **39/39**;
- virtual-loopback scenarios: **5/5**;
- blocked commands prove zero signal with `hardwareSignalSent:false` and
  `hardwareSignalState:not_sent`;
- ambiguous sends are `attempted_unconfirmed`, never acknowledged execution;
- SG90 acknowledgement is `command_acknowledged_open_loop` with
  `physicalOutcomeVerified:false`.

### Build and package — pass

Required commands:

```powershell
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.next.json --noEmit
npx tsc -p electron/tsconfig.json --noEmit
npm run verify
npm run desktop:pack
```

`desktop:pack` must fail unless the versioned NSIS installer, application asar,
unpacked Next runtime, compiled shared safety runtime, firmware SHA256 pairs,
branding metadata, and Windows serialport bindings are all present. The
packaged executable smoke path must also exit successfully.

Expected artifact:

```text
release/RealityWarden-0.3.0-Setup.exe
```

Verified local artifact record (2026-07-14):

- size: `165911345` bytes (`158.23 MiB`);
- SHA256: `ED01B73AA0B31EDADCA09DB326073D890FD61FC360A0503D8C8ED5505F4E0D7F`;
- executable FileVersion/ProductVersion: `0.3.0`;
- package verification: pass (shared runtime, Next runtime, three serialport
  native bindings, firmware image + SHA256, branding);
- packaged `RealityWarden.exe --prod --smoke-test`: pass.

### Documentation — pass

- README, Evaluation Guide, Windows Trial Guide, release notes, and package
  metadata agree on v0.3.0 Public Alpha.
- Real execution is described accurately rather than hidden or overstated.
- No document treats physical acceptance as a software release blocker.

## Manual release actions still outside this report

- optional code-signing and publisher identity;
- manual tag and GitHub release creation;
- installer upload and checksum publication;
- optional refreshed demo recording;
- optional physical reference-kit evidence capture.

None of these may weaken the automated safety gates or alter the truthful Public
Alpha boundary.
