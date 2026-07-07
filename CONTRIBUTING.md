# Contributing to RealityWarden

RealityWarden is a simulation-first desktop runtime for Physical AI workflows. It lets AI-driven tasks pass through device descriptions, capability checks, safety decisions, simulation, and audit trails before any future adapter boundary.

## What a Reality Asset Is

A Reality Asset is a descriptive package for a physical or simulated device. It can describe a robot, drone, lab device, smart device, factory sensor, or other Physical AI system.

Reality Assets are not executable plugins. They are not hardware drivers. They do not grant real device control.

## What You Can Submit

- Device descriptions and manifests
- Capability contracts
- World model assumptions
- Safety boundaries and blocked behaviors
- Example supported prompts
- Example unsupported or ambiguous prompts
- Simulation-only validation notes
- Documentation improvements

## What You Cannot Submit

- Real hardware execution code
- Adapter code that controls physical devices
- Credentials, tokens, endpoints, or secrets
- Shell commands, `eval`, postinstall scripts, or webhook behavior
- Auto-execution behavior
- Destructive action claims
- Claims that community assets are verified for hardware execution

## Community Asset Rules

Community Reality Assets are descriptive only.

Community assets must not execute code.

Community assets are simulation-only by default.

Real execution is disabled by default.

Adapter code is not accepted in community asset submissions.

Hardware execution requires separate review, certification, and explicit local enablement.

RealityWarden remains simulation-first.

## How to Submit a Reality Asset Draft

1. Read [SECURITY.md](./SECURITY.md).
2. Start from [examples/community-assets/README.md](./examples/community-assets/README.md).
3. Prepare a JSON asset draft with:
   - `assetId`
   - `name`
   - `deviceManifest`
   - `capabilityContracts`
   - `adapterBoundary`
   - `examplePrompts`
   - `supportLevel`
   - `safetyNotes`
4. Keep `realAdapterEnabled` set to `false`.
5. Open a GitHub issue using the "Submit Reality Asset" template, or open a PR if you have a complete simulation-only draft.

## Validate Locally

Run the project validation suite before opening a PR:

```bash
npm run typecheck
npm run build
npm run verify
```

Validate a Reality Asset JSON file:

```bash
node scripts/validate-reality-asset.cjs examples/community-assets/example_drone.asset.json
```

## Review Process

Maintainers check community submissions for:

- simulation-only boundaries
- complete device descriptions
- safe capability wording
- no credentials or endpoints
- no executable behavior
- no real adapter enablement
- clear supported, unsupported, and ambiguous prompts
- local validation results

Passing schema validation does not mean real hardware execution is safe or supported.

## Safety Boundaries

Open Reality follows this contribution principle:

**Permissionless contribution. Permissioned execution.**

Anyone can propose a device asset description. Real execution remains disabled unless a future review process explicitly enables a separate, local, safety-gated adapter path.

## Current Public Alpha Boundary

The current Public Alpha is simulation-first. Real device execution is disabled by default. Community assets are unverified by default and must not be treated as physical device control instructions.
