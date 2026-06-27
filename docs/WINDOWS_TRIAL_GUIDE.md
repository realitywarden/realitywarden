# Windows Trial Guide

Use this guide when you want to try the current `v0.1.1 Public Alpha` on Windows.

This is an early **simulation-only desktop prototype**.

It is not real-device control software.

## What You Can Actually Run

Runnable device paths in the current Public Alpha:

- `robot_arm`
- `smart_light`
- `camera_sensor`

Other built-in device families are visible in the workspace, but they are still:

- `Coming Soon`
- not runnable in the main Run flow
- not valid evidence of finished runtime support

## Option A: Try a Built Installer

If you already have a packaged installer, the expected Windows installer file looks like:

```text
Open-Reality-Studio-0.1.1-Setup.exe
```

Install flow:

1. Launch the installer.
2. Choose an install directory if needed.
3. Finish the installer.
4. Start `Open Reality Studio`.

Expected first-run outcome:

- the desktop window opens
- the virtual workspace shows the default robot arm
- the AI Command input is visible
- the product does not require real hardware

## Option B: Build the Installer From Source

From the repository root:

```bash
npm install
npm run desktop:pack
```

Expected output:

```text
release/Open-Reality-Studio-0.1.1-Setup.exe
```

If you only want to run the desktop shell from source in a production-like mode without generating an installer:

```bash
npm run desktop:prod
```

If you are actively developing the UI, use:

```bash
npm run desktop:dev
```

## First Evaluation Path

Do not start by clicking random device families.

Use this order:

1. `robot_arm`
2. `smart_light`
3. `camera_sensor`

Then use [docs/EVALUATION_GUIDE.md](./EVALUATION_GUIDE.md).

## Recommended First Commands

### Robot Arm

Safe example:

- `Move the red cube to the back safe zone`
- `把红方块放到后侧安全区`

Blocked example:

- `Throw the red cube off the table`
- `把红方块扔出桌面`

### Smart Light

- `Turn on the light`
- `Set the light to blue`
- `打开智能灯`
- `把灯改成蓝色`

### Camera Sensor

- `Take a photo`
- `拍一张照片`

## What Correct Behavior Looks Like

`robot_arm`:

- safe task executes
- blocked unsafe task does not move the arm
- playback and logs update

`smart_light`:

- on/off works
- brightness changes are visible
- color changes are visible

`camera_sensor`:

- capture and read feedback appears
- unsupported prompts fail clearly

## What Is Not A Bug In This Alpha

These are current product boundaries:

- non-runnable device families show `Coming Soon`
- unsupported prompts fail instead of silently guessing
- there is no real hardware execution

## When To Stop And Re-check

If you see any of these, stop and verify the run target first:

- you selected a non-runnable device family
- the current run target does not match the device you expected
- you expected real hardware execution from the desktop alpha
