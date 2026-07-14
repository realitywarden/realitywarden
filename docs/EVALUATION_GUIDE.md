# Evaluation Guide

This guide is for the current `v0.5.0 Public Alpha`.

Use it when you want a clean first evaluation of the product without guessing which prompts or device paths are actually supported.

## What This Alpha Is

RealityWarden Desktop is a **simulation-first** Physical AI workbench. The main AI Command workflow is simulation-only and requires no hardware. A separate REAL HARDWARE boundary exists only for the documented ESP32 reference rig and remains evidence-locked, sensor-gated, operator-confirmed, and visibly distinct.

Runnable device paths in the current Public Alpha:

- `robot_arm`
- `smart_light`
- `camera_sensor`
- manually imported PDF/Markdown/text device proposals after two explicit
  simulation-only reviews

Everything else in the workspace should be treated as:

- visible asset scaffolding
- protocol surface
- Coming Soon runtime coverage

It is **not** general-purpose or production-certified real-device control.

## Best First-Run Path

Recommended evaluation order:

1. `robot_arm`
2. `smart_light`
3. `camera_sensor`

Do not start with `mobile_robot`, `plc_cabinet`, `conveyor_belt`, `lab_instrument`, `warehouse_rack`, or `sensor_box`. Those are not runnable in the main Run path yet.

## Language Note

If the desktop UI is set to Chinese, use the Chinese prompt examples below.

If the desktop UI is set to English, use the English prompt examples below.

For the current Public Alpha, staying close to the documented prompt wording will give the most reliable evaluation result.

## 1. Robot Arm

Expected result:

- safe task executes
- unsafe task is blocked before execution
- playback, logs, and lab report update

### Recommended prompts

Chinese:

- `把红方块放到后侧安全区`
- `把红方块放到左侧安全区`
- `把红方块扔出桌面`

English:

- `Move the red cube to the back safe zone`
- `Move the red cube to the left safe zone`
- `Throw the red cube off the table`

### What you should see

Safe task:

- AI command compiles into a robot-arm task
- Safety gate passes
- Robot arm performs pick-and-place
- Playback and logs show execution progress

Blocked task:

- Safety gate blocks before motion
- No motion frames execute
- Robot arm and object remain still

## 2. Smart Light

Expected result:

- low-risk lighting commands execute
- brightness and color changes are visible
- unsupported prompts fail clearly

### Recommended prompts

Chinese:

- `打开智能灯`
- `关闭智能灯`
- `把灯调亮`
- `把灯调暗`
- `把灯改成蓝色`
- `把灯改成红色`

English:

- `turn on the light`
- `turn off the light`
- `make the light brighter`
- `dim the light`
- `set the light to blue`
- `set the light to red`

### Known unsupported example

- `make the light purple`

Expected unsupported behavior:

- clear unsupported message
- no silent fallback
- no robot-arm commands

## 3. Camera Sensor

Expected result:

- low-risk capture/read feedback executes
- unsupported prompts fail clearly
- no robot-arm motion is triggered

### Recommended prompts

Chinese:

- `拍一张照片`
- `扫描当前区域`
- `读取摄像头状态`

English:

- `take a photo`
- `scan current area`
- `read camera status`

### Known unsupported example

- `inspect the camera feed carefully`

Expected unsupported behavior:

- clear unsupported message
- no silent fallback to capture
- no action frames beyond the supported camera path

## What Not To Expect

Do not expect the following from this Public Alpha:

- general-purpose real-device execution (the separately marked ESP32 reference
  rig is the only gated hardware path)
- production hardware control
- certified industrial safety
- all device families runnable from AI Command
- universal natural-language understanding

## If A Run Fails

Check these first:

1. You selected a runnable device path:
   - `robot_arm`
   - `smart_light`
   - `camera_sensor`
2. The prompt matches the currently supported examples closely.
3. The current run target shown in the UI matches the device you intended to run.

If the run target is a non-runnable device family, the correct behavior is:

- `Coming Soon`
- `Not runnable in this Public Alpha`
- no motion or action execution

## Honest Summary

Use this Public Alpha to evaluate:

- desktop simulation workflow direction
- safety-gated prompt execution
- narrow runnable golden paths

Do not use this Public Alpha as evidence of:

- general real-world hardware compatibility or certified physical outcomes
- full multi-device runtime coverage
- production readiness
