# Device Action Runtime

RealityWarden does not play fixed animations.

Virtual devices move from the same Adapter Commands that future real devices will receive. The runtime is a command-driven action layer: it reads the command, the current device state, the device profile, geometry, and constraints, then produces an ActionPlan and playable ActionFrames.

## Why Not Fixed Animations

Fixed animations make the simulator look active, but they do not prove that a device command is valid. RealityWarden needs the virtual path and the future real-device path to share the same command surface:

Task DSL -> Adapter Commands -> Device Action Runtime -> Virtual Device Motion / State -> Lab Report

Future real device path:

Hardware Command -> SafetyMonitor -> HardwareExecutionGate -> ticketed Hardware Adapter -> Real Device

## AdapterCommand To ActionPlan

Each AdapterCommand is passed to `DeviceActionRuntime.createActionPlan()`.

The runtime:

1. Reads the current DeviceState.
2. Reads `device.meta.json`, `geometry.json`, and constraints.
3. Selects the matching DeviceActionModel for the `device_type`.
4. Validates reachability, allowed actions, forbidden zones, and command constraints.
5. Produces an ActionPlan.

An ActionPlan records command identity, target, start state, end state, duration, validation result, and frames.

## ActionFrames

ActionFrames are generated from command parameters and state. They are not pre-authored clips.

Each frame contains:

- `time_ms`
- `progress`
- `device_state`
- `visual_state`
- `command_id`
- `status`

The Virtual Device Stage renders `currentActionFrame.visual_state` while playback is active. When playback is idle, it renders saved device state.

## Device Models

The runtime includes action models for:

- Robot arm: `move_to_pose`, `grasp`, `release`, `return_home`
- Mobile robot: `navigate_to`, `dock`
- Smart light: `set_light`, `set_brightness`, `set_color`
- Camera sensor: `capture_frame`, `read_sensor`
- Conveyor belt: `start_belt`, `sort_item`, `stop_belt`
- PLC cabinet: `read_register`, `write_register`, `start_sequence`, `stop_sequence`
- Lab instrument: `read_measurement`, `set_parameter`, `start_test`, `stop_test`
- Warehouse rack: `scan_slot`, `reserve_slot`, `release_slot`, `mark_item`
- Sensor box: `read_sensor`, `calibrate_sensor`, `reset_sensor`

## Kinematics And Collision Awareness

The current runtime includes a lightweight kinematic layer:

- Robot arm movement uses a planar two-link IK solver.
- IK diagnostics record reach, max reach, and reachability.
- Mobile robot movement uses a waypoint path planner.
- The path planner samples restricted zones and produces detour waypoints when a direct line crosses a restricted area.
- Action validation records target position, IK diagnostics, path diagnostics, workspace bounds checks, and collision risk.

This is still not a rigid-body physics simulator, but it is no longer a simple final-state transition or fixed animation clip.

## Playback

`PlaybackEngine` reads a LabReport and regenerates ActionFrames from the report's Adapter Commands. It does not invent UI animation. Timeline selection can inspect a command snapshot; Replay can play generated frames into the stage.

## BLOCKED Commands

Blocked commands generate a blocked ActionPlan with zero execution frames. Device state is preserved. The Lab Report records the blocked ActionPlan summary, but the Virtual Device Stage does not execute motion frames for it.

## Lab Report

Lab Reports include `action_plans` summaries:

- `command_id`
- `action`
- `target`
- `duration_ms`
- `validation`
- `start_state`
- `end_state`
- `frame_count`

Full frames are not exported by default to avoid oversized reports. Playback regenerates frames from commands, profiles, geometry, and state.

## Current Fidelity

This is not an industrial physics engine. It is a usable virtual action layer that makes simulated devices respond to the same Adapter Commands as future real devices.

Current fidelity:

- Command-driven state and motion
- ActionPlan and ActionFrame generation
- Basic robot-arm IK
- Basic waypoint path planning
- Workspace and restricted-zone diagnostics

The next fidelity step is richer collision geometry, stronger robot kinematics, and configurable physics constraints per imported device asset.
