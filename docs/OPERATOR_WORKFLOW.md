# Operator Workflow

This document describes the standard Open Reality Studio operator workflow. It is the expected verification path for a virtual lab workspace.

## Workflow

1. Select a language in Settings.
2. Drag one or more virtual devices into the workspace.
3. Select a Device Type, Device Profile, and Scenario.
4. Review or edit the Prompt.
5. Run Compile & Execute.
6. Inspect Safety Runtime results before any adapter command is considered executable.
7. Inspect Task DSL and Adapter Commands.
8. Replay the Execution Timeline and inspect state snapshots.
9. Run Workspace Validation for all enabled devices.
10. Export the Lab Report or Adapter Package after validation.

## Expected Behavior

- Safe scenarios must pass Safety Runtime and update virtual device state.
- Unsafe scenarios must be blocked before adapter execution.
- Blocked runs must preserve the pre-execution device state.
- The timeline must keep state snapshots for each execution step.
- Exported adapter packages must include validation status, workspace issues, safety report, adapter commands, before/after state, and a digest.

## Real Hardware Boundary

Open Reality Studio is currently a Virtual Lab. Real hardware execution is not exposed as the main product path. Future real device execution must go through certified adapters, verified transports, human supervision, and the same Device Profile, Task DSL, Safety Runtime, and Adapter Interface used by the simulator.
