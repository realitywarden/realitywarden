# Product Requirements

RealityWarden is a desktop Virtual Lab for AI-controlled devices.

The product goal is to let developers build, simulate, test, debug, replay, validate, and audit AI-controlled device workflows before touching real hardware.

## Current Product Path

- No hardware required
- Multi-device virtual workspace
- Device Profile driven simulator
- Prompt to Task DSL
- Safety Runtime before adapter execution
- SimulatorAdapter for virtual execution
- state inspector
- timeline replay
- workspace validation
- Lab Report export
- adapter package export

## Explicit Boundary

Real hardware is an explicit secondary path behind `HardwareExecutionGate`, a private actuation ticket, operator confirmation, and evidence locking. It is never represented by the simulation `AdapterInterface`.
