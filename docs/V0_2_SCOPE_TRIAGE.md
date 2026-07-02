# v0.2 Scope Triage

This document freezes the current v0.2 repository scope and classifies legacy dirty work that should not silently enter the Public Alpha mainline.

Current baseline:

- Latest intended product commit before triage: `c577284 feat: add product narrative frontend`
- Product boundary: simulation-first Public Alpha
- Real device execution: disabled
- Production hardware control: not supported
- Runtime Kernel, Safety Governor, Planner, TaskDSL, Reality Asset validation, and adapter execution boundaries are not changed by this triage.

## Classification States

- `accept_into_v0_2`: mature enough to enter the current v0.2 mainline.
- `move_to_drafts`: useful work, but it must be explicitly marked draft or experimental before becoming public-facing product surface.
- `ignore_generated`: generated or local export material that should be ignored rather than committed.
- `keep_local_uncommitted`: local material that may be useful later, but should not enter the current commit.
- `reject_for_now`: should not enter v0.2 because it is out of scope, misleading, or conflicts with current boundaries.

## Current Dirty File Inventory

| Path | Classification | Reason | Simulation-first impact | Real-device implication | Follow-up needed |
| --- | --- | --- | --- | --- | --- |
| `docs/ADAPTER_SDK.md` | `move_to_drafts` | The new section describes protocol intake examples and adapter SDK examples that are not wired into package scripts or the formal adapter SDK contract. It is useful but should be marked as an Adapter Boundary Draft before publication. | No direct runtime impact. | Must state real execution is disabled by default and that examples are simulation-only. | A dedicated Adapter Boundary Draft sprint should reconcile this with `lib/adapter-sdk` and existing tests. |
| `docs/PROTOCOL.md` | `move_to_drafts` | The new content references `lib/protocol/*` and generated protocol artifacts. The repository already has `lib/open-reality-protocol`, so publishing this as official could create two protocol surfaces. | No direct runtime impact. | Does not enable real devices, but could imply a more mature protocol than currently guaranteed. | A Protocol Consolidation sprint should merge or reject the experimental `lib/protocol` track. |
| `lib/protocol/` | `move_to_drafts` | Contains a parallel protocol experiment (`OpenRealityProtocol`, `DeviceManifest`, `RealityAsset`, `CapabilityNormalizer`, `RuntimePermission`, tests). It overlaps with existing `lib/open-reality-protocol` and is not part of current package scripts. | No direct runtime impact if left uncommitted. | `RuntimePermission` correctly keeps `real_device.execute` false, but the folder needs a draft label and integration review. | Compare against `lib/open-reality-protocol` and decide one canonical protocol surface. |
| `examples/protocol/` | `move_to_drafts` | Contains generated protocol catalog/support/runnable/intake JSON artifacts. Useful for developer review, but generated artifacts should not become official without the generator scripts and contract being stabilized. | No direct runtime impact if left uncommitted. | The examples preserve runnable subset boundaries, but may be mistaken for a stable protocol release. | Move to `examples/drafts/protocol/` or regenerate from an official protocol package later. |
| `examples/adapter-sdk/` | `move_to_drafts` | Contains a simulation adapter stub and intake summary. It is useful as an onboarding draft but not an official SDK because the current Public Alpha does not expose real adapters. | No direct runtime impact if left uncommitted. | Must remain simulation-only and explicitly reject real execution. | Move to `examples/drafts/adapter-sdk/` after adapter boundary docs are reconciled. |
| `scripts/export-protocol-catalog.cjs` | `keep_local_uncommitted` | Generates protocol catalog artifacts, but there is no committed package script for it and it depends on the experimental `lib/protocol` track. | No runtime impact if left local. | Does not enable real devices, but could imply official protocol export support. | Keep local until protocol consolidation decides whether to ship export tooling. |
| `scripts/build-protocol-consumer-example.cjs` | `keep_local_uncommitted` | Local generator for protocol consumer examples. It should not enter main until its inputs and outputs are official. | No runtime impact. | No direct real-device execution; still part of experimental protocol flow. | Revisit with protocol examples. |
| `scripts/build-adapter-intake-example.cjs` | `keep_local_uncommitted` | Local generator for adapter intake examples. Not documented in package scripts and tied to experimental artifacts. | No runtime impact. | Must remain simulation-only if formalized. | Revisit in Adapter Boundary Draft sprint. |
| `scripts/build-adapter-sdk-example.cjs` | `keep_local_uncommitted` | Local generator for adapter SDK example summary/stub. It is not currently an official project script. | No runtime impact. | Must not imply real adapter execution. | Revisit after adapter SDK boundary is stable. |
| `scripts/generate-brand-icon.py` | `keep_local_uncommitted` | Generates branding icon assets. It is not part of protocol/adapter scope, depends on Pillow, and is not needed for v0.2 runtime scope freeze. | No runtime impact. | None. | Handle in a separate brand asset hygiene sprint if needed. |
| `assets/social/` | `keep_local_uncommitted` | Contains social avatar/header images. Small enough for Git, but social launch assets are out of scope for v0.2 runtime/protocol triage and should not be mixed with protocol work. | No runtime impact. | None. | Review in a separate brand/social asset sprint; reject files with watermarks or stale claims before committing. |

## Scope Freeze Decisions

### Accepted into v0.2 now

Only this triage document is accepted into the current v0.2 mainline.

Rationale:

- It records the decision boundary without promoting experimental protocol or adapter work.
- It does not change runtime behavior.
- It keeps the current Public Alpha claim honest.

### Drafts to formalize later

The protocol and adapter SDK materials are considered useful but not official:

- `docs/PROTOCOL.md` additions
- `docs/ADAPTER_SDK.md` additions
- `lib/protocol/`
- `examples/protocol/`
- `examples/adapter-sdk/`

Before any of these enter main, they must be marked with:

> Draft / Experimental / Not part of Public Alpha runtime guarantee.

They also need reconciliation with the already committed surfaces:

- `lib/open-reality-protocol/`
- `lib/adapter-sdk/`
- `tests/open-reality-protocol/`
- `tests/adapter-sdk/`

### Generated or local files

No current dirty file is being deleted or ignored in this sprint.

The current `.gitignore` already covers:

- local video exports via `demo/`
- build outputs via `.next/`, `.next-build/`, `.next-desktop-*`, `dist-electron/`, `release/`
- environment files via `.env` and `.env.*`
- temporary logs and smoke screenshots

The social images and generator scripts are kept local and uncommitted for now instead of being ignored globally, because they may become useful after review.

## Safety and Boundary Review

No dirty file reviewed in this sprint was found to contain:

- API keys, tokens, or secrets
- hard-coded local absolute paths such as `F:\` or `E:\`
- production real-device execution enablement
- `production-ready`
- `industrial-grade`
- `real device execution supported`
- `certified protocol`
- `cryptographically audited`
- `marketplace-ready`

Risk:

- The experimental protocol and adapter drafts could confuse users if shipped as official documents before reconciliation.
- The generated protocol artifacts could look like a stable protocol release even though the current official protocol surface is smaller.
- The adapter SDK examples could imply real-device onboarding if not clearly marked simulation-only.

## Required Follow-up

Recommended next single target:

> Protocol and Adapter Draft Consolidation

Scope:

1. Compare `lib/protocol/` with `lib/open-reality-protocol/`.
2. Decide one canonical protocol namespace.
3. Move useful experimental files under `docs/drafts/` or `examples/drafts/`.
4. Add explicit draft headers.
5. Keep `realDeviceExecution = false`.
6. Do not add real hardware adapters.

