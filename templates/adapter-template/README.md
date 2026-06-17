# Adapter Template

This template shows the minimum shape of an Open Reality adapter. It is not connected to real hardware.

## Files

- `device.meta.json`: declares device identity, capabilities, workspace, forbidden zones, and safety profile.
- `actions.ts`: maps validated Task DSL actions to adapter-level functions.
- `safety.rules.ts`: declares local adapter safety assumptions that must match the Safety Runtime.
- `adapter.ts`: executes only validated steps and returns an Execution Report style object.

## Integration Flow

```text
LLM / Agent
-> Open Reality MCP Server
-> Device Meta
-> Task DSL
-> Safety Runtime
-> Adapter
-> Device
```

## Adapter Rules

1. Do not accept raw natural language commands.
2. Do not execute a task before Safety Runtime approval.
3. Reject actions outside `device.meta.json` capabilities.
4. Reject unknown targets and forbidden zones.
5. Return an execution report for every accepted task.
6. Keep real device credentials, network addresses, and private keys outside the template.

## Starting A New Device Adapter

1. Copy this folder.
2. Update `device.meta.json`.
3. Implement real device calls inside `actions.ts`.
4. Keep `safety.rules.ts` aligned with the Safety Runtime.
5. Run the conformance test before publishing.
