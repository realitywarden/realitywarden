# Security Policy

Open Reality Studio is a simulation-first Public Alpha. Community submissions must not include real device execution behavior.

## Forbidden in Community Assets

Do not submit community assets containing:

- executable code
- shell commands
- `eval`
- postinstall scripts
- device endpoint URLs
- API keys
- tokens
- credentials
- webhooks
- `realAdapterEnabled: true`
- auto-execution behavior
- destructive actions
- motion, heat, pressure, unlock, or actuation claims unless they are explicitly described as simulation-only and bounded by safety notes

Community Reality Assets must remain descriptive. They must not include adapter code or runtime hooks.

## Reporting Security Issues

Do not open public issues for secrets or security-sensitive reports.

Use GitHub security advisories if enabled. If private advisories are not available, contact the repository owner through the public GitHub profile contact path. Do not include secrets in public issues, pull requests, screenshots, logs, or demo assets.

## Public Alpha Boundary

- Real device execution is disabled by default.
- Community assets are unverified by default.
- Validation only checks schema and safety-boundary requirements.
- Validation does not certify hardware execution.
- Adapter code for real hardware is not accepted through community asset submissions.
