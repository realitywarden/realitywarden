# RealityWarden v0.5.0 Public Alpha Release Readiness

This report records software and packaging readiness. It does not create a tag,
push a branch, sign binaries, publish a release, or claim production readiness.

## Decision

Status: **software release candidate ready**

The v0.5.0 source, documentation, package contract, automated safety gates, and
versioned Windows installer are aligned. The packaged executable passed the
production smoke path. Physical reference-kit testing is optional field
evidence, not a development or release-engineering prerequisite.

## Readiness gates

### Product boundary — pass

- AI Command remains the default simulation workflow and sole Run/Stop surface.
- Manual-derived profiles and assets remain permanently simulation-only.
- REAL HARDWARE is visually independent and limited to the reference rig.
- Evidence lock, operator confirmation, default-block interlocks, private ticket
  path, and explicit `real_hardware` audit labeling remain intact.

### Safety and product evidence — pass

- real-hardware invariant suite: **43/43**;
- virtual-loopback scenarios: **5/5**;
- manual-import malicious-input, second-gate, and explicit action-install suite: **21/21**;
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
npm run test:real-hardware
npm run test:virtual-loopback
node lib/desktop/runDesktopTests.js
node lib/conformance/runConformance.js
npm run verify
npm run desktop:pack
```

`desktop:pack` must fail unless the versioned NSIS installer, app asar, unpacked
Next runtime, compiled shared safety runtime, pinned `pdfjs-dist`, manual-import
UI boundary, firmware SHA256 pairs, branding metadata, and Windows serialport
bindings are present. It must then run the packaged executable with
`--prod --smoke-test` successfully. The smoke is a packaged first-run renderer smoke, not only a local-server readiness probe: it loads the renderer in an isolated session and verifies the desktop regions, sole Run/Stop controls, simulation/REAL HARDWARE separation, and preload bridge. Failure exits non-zero.

Expected artifact:

```text
release/RealityWarden-0.5.0-Setup.exe
release/RealityWarden-0.5.0-Release-Evidence.json
release/RealityWarden-0.5.0-Release-Evidence.json.sha256
```

The evidence manifest is emitted only after package verification and first-run renderer smoke succeed. It records the exact installer SHA256 and size, packaged Next BUILD_ID, source commit, and clean/dirty worktree state. Its companion checksum protects the evidence record itself. It deliberately marks code signing and optional physical-hardware acceptance as not assessed rather than inventing evidence.

Verified local artifact record (2026-07-14):

- size: `186168889` bytes (`177.54 MiB`);
- SHA256: `87AE920E068D80D5F86B90B1E95B007CFAE0CEC62900ECA45A9221F209CC2BB3`;
- executable FileVersion/ProductVersion: `0.5.0`;
- package verification: pass (shared runtime, Next runtime, manual/PDF import
  boundary, pinned pdfjs runtime, three serialport native bindings, firmware
  image + SHA256, and branding);
- packaged `RealityWarden.exe --prod --smoke-test`: pass.

## Manual release actions outside this report

- optional code signing and publisher identity;
- manual tag and GitHub release creation;
- installer upload and checksum publication;
- optional refreshed demo or physical reference-kit evidence.

None of these may weaken the automated safety gates or alter the truthful Public
Alpha boundary.
