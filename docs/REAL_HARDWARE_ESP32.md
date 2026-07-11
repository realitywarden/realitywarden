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

If distance reads fail, run the read-only diagnostic first. It never sends a
servo command:

```bash
npm run hardware:diagnose -- --port COM3
```

With the latest firmware it reports firmware/protocol versions, configured
pins, the ECHO idle level, three firmware-side echo attempts, repeated host-side
distance samples, device-clock health, and a classified conclusion. Older
firmware is detected explicitly and can still receive the basic distance test.

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

## Troubleshooting (field-tested)

Symptoms below were observed on real rigs (ESP32-S3 DevKit + HC-SR04 +
breadboard power module). Work through them top-down: power first, then
wiring, then serial, then signal quality.

### Power bank powers the rig, then everything dies after ~30s

Most USB power banks auto-sleep when the load stays under ~50-100 mA. An idle
ESP32 + HC-SR04 draws less than that, so the bank cuts output and the board
browns out mid-session.

```
[sensor] no distance data: timeout waiting for response id sensor-1720...
FAIL  ESP32 主协议无响应：检查 COM3、115200 波特率和固件运行状态。
```

Fix: power from the PC USB port or a mains charger, or use a power bank with
an "always-on" / low-current mode. A trickle load (e.g. keeping the servo
attached) is not reliable enough to keep every bank awake.

### Sensor powered from an external supply reads nothing (missing common ground)

If the HC-SR04 (or a breadboard power module) uses a different supply than the
ESP32, the ECHO pulse has no return path unless the grounds are tied together.
The sensor LED may light up, TRIG fires, but the ESP32 never sees ECHO rise:

```
  #1 FAIL no echo pulse (sensor disconnected, underpowered, or target out of range)
```

Fix: connect external supply GND ↔ ESP32 GND with a dedicated jumper. This is
the single most common cause of "no echo" on split-supply breadboards.

### ESP32-S3: two serial ports, and the demo talks to the wrong one

ESP32-S3 boards expose two USB connectors / two COM ports: the UART0 bridge
(labelled "COM"/"UART", used for flashing) and the native USB-CDC port
(labelled "USB"/"OTG"). Firmware `Serial` output goes to whichever the sketch
was built for (`USB CDC On Boot` in Arduino IDE). If you point
`--port` at the flashing UART while the firmware prints on CDC (or vice
versa), the port opens fine but every request times out:

```
PASS  串口已打开；等待 ESP32 启动...
WARN  诊断命令无响应：timeout waiting for response id diag-1720...
```

Fix: check Device Manager for both ports, and try the other one. Flash over
UART0; run the demo/diagnose against the port where the firmware actually
prints (with `USB CDC On Boot: Enabled`, that is the native USB port).

### Readings are always exact multiples of 0.0172 cm (≈ integer microseconds)

If every reported distance is a tiny value that is an exact multiple of
0.0172 cm (1 µs / 58), the "echo" is only a microsecond-scale glitch —
crosstalk from the TRIG edge, not a real ultrasonic round trip. The transmitter
side of the sensor is not firing (dead module, insufficient voltage, or TRIG
never reaching the sensor):

```
  #1 PASS 0.1 cm deviceMs=5123 (18ms)   ← 6 µs "echo" = noise, not sound
  #2 PASS 0.0 cm deviceMs=5241 (17ms)
```

A real reading at 10-400 cm produces echo durations of 580-23200 µs. Anything
under ~100 µs repeatedly is electrical noise. Fix: verify sensor VCC (HC-SR04
transmitters usually need a solid 5V to fire; at 3.3V many clones never
transmit), verify TRIG actually reaches the sensor pin, or replace the module.

### Breadboard power module: check the jumper voltage selectors

MB102-style breadboard power boards select 3.3V or 5V **per rail** with
jumpers, and shipping defaults vary. A rail jumpered to 3.3V (or to OFF) will
underpower the HC-SR04 → weak or absent transmit → intermittent `no echo` or
glitch-only readings as above. Fix: set the rail feeding the sensor to 5V,
confirm with a multimeter, and remember both rails are independent.

### ECHO is a 5V output — divide it before GPIO4

ESP32 (and especially ESP32-S3) GPIOs are not 5V tolerant. When the sensor
runs at 5V, ECHO swings to 5V and must go through a divider: ECHO → 1kΩ →
GPIO4, GPIO4 → 2kΩ → GND (5V × 2/3 ≈ 3.3V). Feeding 5V directly into GPIO4
may work briefly, then damages the pin — a classic pattern is a rig that
worked on day one and reads `no echo pulse` forever after. If the divider is
in place but readings are still absent, run the wiring self-test:

```bash
npm run hardware:diagnose -- --port COM3 --loopback   # jumper GPIO5 → GPIO4 first
```

A passing loopback proves both GPIOs and the breadboard path are alive, which
isolates the fault to the sensor or its power.

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
