# Real Hardware: ESP32 + SG90 Servo + HC-SR04 (RealityWarden)

This is the first REAL hardware execution path in RealityWarden. It is fully
separate from the simulation runtime, and it obeys the six core invariants:
blocked commands never reach hardware, offline never fakes success, missing /
stale / implausible sensor data default-blocks actuation, every decision is
audited with `hardwareSignalSent`, there is no silent fallback, and real
execution is always labeled `real_hardware`.

## What you need

- ESP32 DevKit (any board with USB serial)
- SG90 servo (signal on GPIO 18)
- HC-SR04 ultrasonic distance sensor (TRIG GPIO 5, ECHO GPIO 4 through a
  voltage divider — ECHO is 5V, the ESP32 pin is 3.3V)
- USB cable, Arduino IDE with the `ESP32Servo` and `ArduinoJson` libraries

## 1. Flash the firmware

Open `firmware/esp32-realitywarden/esp32-realitywarden.ino` in the Arduino IDE,
pick your ESP32 board and port, and upload. The firmware speaks
newline-delimited JSON at 115200 baud and refuses (never clamps) angles
outside 0-180.

## 2. Install the serial driver package (one time)

```bash
npm install serialport
```

Without it, the runtime raises an explicit error. It will not silently fall
back to simulation.

## 3. Run the acceptance scenarios

```bash
npm run hardware:demo -- --port COM3            # scenarios 1 + 2
npm run hardware:demo -- --port COM3 --scenario 3   # hold an object < 10cm from the sensor
npm run hardware:demo -- --port COM3 --scenario 4   # unplug the HC-SR04 first
```

Expected results:

1. `move_to_angle 45` → executed, the servo moves, audit shows
   `hardwareSignalSent: true`.
2. `move_to_angle 200` → BLOCKED (outside 0-180), the servo does not move,
   audit shows `hardwareSignalSent: false`.
3. Legal angle with an obstacle closer than `--min-safe-cm` (default 10) →
   BLOCKED by sensor policy.
4. Sensor unplugged or silent → BLOCKED (default-block: no data means no
   actuation).

Every run prints the full audit log as JSON; each entry carries an explicit
`hardwareSignalSent` boolean.

## 4. Run the safety invariant tests (no hardware needed)

```bash
npm run test:real-hardware
```

These are behavioral spy/mock tests. Among other things they assert that when
the safety layer blocks a command, the hardware adapter's `execute()` is
called exactly zero times and zero frames reach the wire.

## Architecture (host side)

```
HardwareExecutionGate.run(command)
  └── SafetyMonitor.evaluateHardwareCommand   ← angle limits + sensor policy
        ├── blocked → audit(hardwareSignalSent=false) → NEVER touches adapter
        └── allowed → Esp32DeviceAdapter.execute
                        └── SerialEsp32Transport (RealDeviceTransport)
                              └── serialport → ESP32 firmware
```

Key files: `lib/hardware/` (types, transport, adapter, gate),
`lib/runtime/SafetyMonitor.ts` (`evaluateHardwareCommand`),
`lib/runtime/RuntimeAuditLog.ts` (`hardwareSignalSent`, `exportJson`),
`tests/real-hardware/realHardware.test.ts`.
