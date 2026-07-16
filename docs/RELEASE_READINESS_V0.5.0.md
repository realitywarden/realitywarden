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

- real-hardware invariant suite: **46/46**;
- virtual-loopback scenarios: **5/5**;
- manual-import malicious-input, second-gate, and explicit action-install suite: **21/21**;
- blocked commands prove zero signal with `hardwareSignalSent:false` and
  `hardwareSignalState:not_sent`;
- ambiguous sends are `attempted_unconfirmed`, never acknowledged execution;
- SG90 acknowledgement is `command_acknowledged_open_loop` with
  `physicalOutcomeVerified:false`.

### Build and package — pass

The installed application includes an offline support guide and recovery
references. The visible File menu and native Help menu expose the guide, local
About/version boundary, and a user-initiated diagnostic export. Diagnostics are
bounded, allowlisted, path/secret-redacted, local-only, and explicitly exclude
project content, prompts, audit/hardware results, serial ports, environment
variables, and credentials.

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
npm run desktop:pack:production
```

`desktop:pack` must fail unless the versioned NSIS installer, app asar, unpacked
Next runtime, compiled shared safety runtime, pinned `pdfjs-dist`, manual-import
UI boundary, firmware SHA256 pairs, branding metadata, and Windows serialport
bindings are present. It must then run the packaged executable with
`--prod --smoke-test` successfully. The smoke is a packaged first-run renderer smoke, not only a local-server readiness probe: it loads the renderer in an isolated session and verifies the desktop regions, sole Run/Stop controls, simulation/REAL HARDWARE separation, and preload bridge. Failure exits non-zero.

The packaged executable must then pass the versioned product-design acceptance
matrix: 1440×900 and 1180×720 in Chinese and English, Windows 125% and 150%
scaling, dialog boundaries and focus restoration, trusted keyboard focus, and
forced-colors REAL HARDWARE separation. This is measured from the packaged
renderer and emitted as machine-readable evidence, not inferred from source or
static screenshots.

After the unpacked smoke, the packaging gate performs an isolated Windows
current-user lifecycle in a dedicated temporary directory: clean silent install,
installed first-run renderer smoke, a safe-executed then unsafe-blocked journey
with one-step Audit & Governor evidence, forced-offline startup with an explicit rule
compiler degradation label, deterministic in-place reinstall, and silent
uninstall. It refuses to run if any pre-existing RealityWarden uninstall
registration is present, so release verification cannot overwrite a user's
installation. Reinstall and uninstall must preserve user project/profile data;
the installed application payload and uninstall registration must be removed.

Expected artifact:

```text
release/RealityWarden-0.5.0-Setup.exe
release/RealityWarden-0.5.0-Startup-Acceptance.json
release/RealityWarden-0.5.0-Startup-Acceptance.json.sha256
release/RealityWarden-0.5.0-Design-Acceptance.json
release/RealityWarden-0.5.0-Design-Acceptance.json.sha256
release/RealityWarden-0.5.0-Install-Lifecycle.json
release/RealityWarden-0.5.0-Install-Lifecycle.json.sha256
release/RealityWarden-0.5.0-Release-Evidence.json
release/RealityWarden-0.5.0-Release-Evidence.json.sha256
# production mode only:
release/RealityWarden-0.5.0-Authenticode-Evidence.json
release/RealityWarden-0.5.0-Authenticode-Evidence.json.sha256
```

The schema-v5 release evidence manifest is emitted only after package
verification, first-run renderer smoke, packaged startup/product-design
acceptance, and the Windows install lifecycle succeed. It records the exact
installer SHA256 and size, packaged Next BUILD_ID, startup/design/lifecycle
manifest digests, source commit, and clean/dirty worktree state. Companion
checksums protect all evidence records. Production mode additionally requires
checksummed Authenticode evidence proving both the packaged executable and NSIS
installer are `Valid` and timestamped, bound to their exact SHA256 digests.
Historical internal-pack evidence deliberately marks code signing, migration
from a different historical version, and optional physical-hardware acceptance
as not assessed rather than inventing evidence. A publishable build must use
`desktop:pack:production`, which additionally refuses to start unless the
release has a production-valid Official signed-catalog configuration and a
Windows code-signing certificate input.

Verified local artifact record (2026-07-15):

- size: `186503174` bytes (`177.86 MiB`);
- SHA256: `B7B826906E3F78A4F1232870E540CDD69CE8C89CA210D8730506F4C0EDD78C3C`;
- clean source commit: `18a40f00da8695bb8c2ea971bc1074172f41e23b`;
- executable FileVersion/ProductVersion: `0.5.0`;
- package verification: pass (shared runtime, Next runtime, manual/PDF import
  boundary, pinned pdfjs runtime, three serialport native bindings, firmware
  image + SHA256, and branding);
- packaged `RealityWarden.exe --prod --smoke-test`: pass.
- packaged product-design matrix: pass (1440×900 / 1180×720,
  Chinese/English, 125%/150% scale, dialogs, focus, and forced colors).
- packaged startup-design matrix: pass (neutral dark first paint,
  Chinese/English, 125%/150% scale, escaped recovery details, reduced motion,
  and forced colors).
- isolated Windows lifecycle schema v2: pass (clean install, installed
  safe/blocked/audit core journey, forced-offline degradation, in-place
  reinstall, uninstall cleanup, and user data preservation).

## Manual release actions outside this report

- owner-controlled Official Marketplace public key/catalog provisioning;
- owner-controlled Windows certificate issuance and signing identity;
- manual tag and GitHub release creation;
- installer upload and checksum publication;
- optional refreshed demo or physical reference-kit evidence.

None of these may weaken the automated safety gates or alter the truthful Public
Alpha boundary.
