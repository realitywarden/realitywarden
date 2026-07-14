# Local Runtime

## What this document is

This document explains the **current Local Runtime boundary** inside RealityWarden.

It does not describe an imagined hardware runtime.
It describes what the repository can actually do today.

## Core claim

RealityWarden is moving from a simulation page toward a **Physical AI Local Runtime**.

The current repository already enforces a meaningful rule:

**AI requests do not go directly into execution.**

Before a request can enter simulation, it must pass through:

- capability inspection
- world-state grounding
- Safety Governor review
- `TaskDSL` generation
- `AdapterPlan` generation
- adapter dry-run
- structured runtime audit logging

## Current execution path

```text
Natural Language
-> Open Reality Runtime Kernel
-> Goal / Planner / Safety Governor
-> TaskDSL
-> Local Runtime Session
-> AdapterPlan
-> Adapter validation
-> Dry Run
-> Simulation-only execution gate
-> Virtual Device Runtime
-> Lab Report / Replay / Audit
```

## What is implemented now

### 1. Runtime decision before execution

The UI run path now enters a Local Runtime session first.

That session decides whether the request is:

- `compiled`
- `blocked`
- `unsupported`
- `ambiguous`
- `not_runnable`
- `ask_human`

Only `compiled` is allowed to continue into simulation.

### 2. Capability-aware gating

The runtime checks whether the selected device can support the requested task.

This matters because the repository no longer pretends every device can run every prompt.

Current runnable simulation paths are intentionally narrow:

- `robot_arm`
- `smart_light`
- `camera_sensor`

Other device families remain `Coming Soon / not_runnable`.

### 3. Safety Governor

The Safety Governor runs before simulation dispatch.

It is responsible for stopping requests such as:

- unsafe manipulation
- unsupported device-task combinations
- ambiguous requests
- requests outside the current simulation boundary

### 4. TaskDSL and AdapterPlan

The runtime does not jump straight from prompt to visual playback.

It first generates:

- a structured `TaskDSL`
- then an `AdapterPlan`

That `AdapterPlan` is validated and dry-run checked before simulation can proceed.

### 5. Runtime audit log

The current Local Runtime also records structured audit entries.

That means the execution path can be reviewed later instead of existing only as transient UI state.

The audit log is now persisted into lab reports.

## Current boundary

This repository is still **simulation-only**.

That is not a marketing phrase. It is a hard boundary.

### What is true

- simulation execution exists
- runtime gating exists
- `TaskDSL` exists
- `AdapterPlan` exists
- audit logging exists
- dry-run enforcement exists
- this LocalRuntime dispatches simulation only; reference hardware uses the separate `HardwareExecutionGate`

### What is not true

- no real device execution through this simulation LocalRuntime
- no production hardware control
- no certified industrial safety guarantee
- no claim that every device family is runnable
- no claim that the current runtime is a shipping industrial control stack

## What should not be exaggerated

Do not describe the current repository as:

- production-ready
- industrial-grade certified
- hardware-enabled
- real-robot execution platform
- complete physical-AI operating system

The correct description is:

**simulation-only Local Runtime prototype for Physical AI workflows**

## Reality Asset relation

Reality Assets are part of the runtime story because they provide structured device-side inputs:

- manifest
- capability contract
- workspace assumptions
- adapter boundary metadata
- validation rules

That means devices are moving away from being just visual cards and toward being runtime-readable entities.

## Safety relation

The Local Runtime is the first place where the project starts behaving like a real execution boundary rather than a UI demo.

Its job is not to make the simulation prettier.
Its job is to ensure that:

1. the request is understood
2. the device can do it
3. the request is safe enough for the current mode
4. the adapter path is valid
5. the result is auditable

## Future Edge Runtime / Reality Chip route

The future direction is not “connect an LLM straight to hardware.”

The future direction is:

```text
Natural Language
-> local runtime
-> safety and capability gates
-> deterministic execution plan
-> adapter boundary
-> device-specific edge execution
```

That future route could eventually split into:

### Edge Runtime

A local execution layer near the device, responsible for:

- low-latency adapter execution
- safety monitoring
- stop / rollback policy
- state feedback
- local audit collection

### Reality Chip

This is still future-facing.

The meaningful interpretation is not “magic AI silicon.”
The meaningful interpretation is a dedicated low-latency safety-and-execution boundary for physical AI systems.

That would only make sense after:

- protocol contracts stabilize
- adapter boundary stabilizes
- runtime session model hardens
- simulation and audit semantics stop changing every sprint

## What should come next

The most sensible next step is not more devices.

It is:

- making runtime decisions even more visible in the product
- hardening protocol and adapter contracts
- strengthening audit / lab report / replay consistency
- preparing a real Edge Runtime plan without enabling hardware execution

## Summary

RealityWarden is no longer just a simulation page.

It now has a real internal execution boundary:

- request understanding
- safety gating
- `TaskDSL`
- `AdapterPlan`
- dry-run
- audit log
- simulation-only execution

That is the correct foundation for any future Physical AI runtime.
