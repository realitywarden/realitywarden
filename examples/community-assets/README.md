# Community Reality Asset Drafts

Community assets are device descriptions submitted by the community.

They are unverified and simulation-only by default.

They do not enable real device execution.

## Status Levels

- **Draft**: proposed by a contributor and not yet reviewed.
- **Unverified**: accepted as a community description, but not validated for real device execution.
- **Validated**: passes schema and validator checks.
- **Rejected**: cannot be accepted because it violates project boundaries or safety requirements.
- **Future Certified**: reserved for a future process. It is not available in the current Public Alpha.

Validated only means the asset passes schema/validator checks.

Validated does not mean real hardware execution is safe or supported.

## Community Asset Rules

- Keep `realAdapterEnabled` set to `false`.
- Do not include adapter code.
- Do not include endpoints, tokens, credentials, shell commands, `eval`, postinstall scripts, or webhooks.
- Do not claim physical execution support.
- Include supported, unsupported, and ambiguous example prompts.
- Include explicit safety notes.

## Example

See [example_drone.asset.json](./example_drone.asset.json) for a safe simulation-only community draft.
