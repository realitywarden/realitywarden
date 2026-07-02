## Summary

Describe the change and why it is needed.

## Safety Checklist

- [ ] This PR does not include real hardware execution code
- [ ] This PR does not include credentials, tokens, endpoints, or secrets
- [ ] Community assets are simulation-only
- [ ] `realAdapterEnabled` is `false`
- [ ] No shell commands / `eval` / postinstall / webhook behavior
- [ ] Safety notes are included
- [ ] Example prompts are included
- [ ] Asset validates locally
- [ ] This does not change Runtime Kernel / Safety Governor / TaskDSL semantics

## Validation

List the commands you ran:

```text
npm run typecheck
npm run build
npm run verify
```
