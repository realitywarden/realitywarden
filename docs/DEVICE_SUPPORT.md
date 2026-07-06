# Device Support

This document describes the actual device support level in the current RealityWarden Desktop Public Alpha.

The goal is to be explicit about what is runnable, what is only visual scaffolding, and what remains Coming Soon.

## Public Alpha Support Matrix

| Device Type | UI Display | Main Run Enabled | Natural Language | Visual Feedback | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `robot_arm` | Yes | Yes | Yes | Yes | Public Alpha | Main golden-path demo |
| `smart_light` | Yes | Yes | Limited zh/en | Yes | Public Alpha | Low-risk simulation only |
| `camera_sensor` | Yes | Yes | Limited zh/en | Yes | Public Alpha | Low-risk simulation only |
| `mobile_robot` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |
| `conveyor_belt` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |
| `plc_cabinet` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |
| `lab_instrument` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |
| `warehouse_rack` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |
| `sensor_box` | Yes | No | No | No main run | Coming Soon | Asset/workspace scaffold only |

## Runnable Paths

### robot_arm

Supported:

- safe task execution
- blocked unsafe task handling
- command-driven playback
- AutonomyCore + RiskJudge path

### smart_light

Supported low-risk prompt examples:

- `turn on the light`
- `turn off the light`
- `make the light brighter`
- `dim the light`
- `set the light to blue`
- `set the light to red`

Unsupported prompts must fail clearly and must not silently fall back.

### camera_sensor

Supported low-risk prompt examples:

- `take a photo`
- `capture a frame`
- `scan current area`
- `read camera status`

Unsupported prompts must fail clearly and must not silently fall back.

## Not Supported in Public Alpha

The following are out of scope for the current public alpha:

- real device execution
- industrial control guarantees
- certified safety for hardware
- autonomous multi-device orchestration
- full natural-language coverage for every device
- runnable AGV / PLC / conveyor / rack / lab flows in main Run

## Honest Summary

This Public Alpha is a simulation-first desktop prototype with three public runnable device paths:

- `robot_arm`
- `smart_light`
- `camera_sensor`

Everything else should be treated as workbench scaffolding, not as finished capability.
