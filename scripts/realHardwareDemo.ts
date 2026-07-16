/**
 * REAL HARDWARE demo / acceptance runner (ESP32 DevKit + SG90 + HC-SR04-compatible sensor).
 *
 * Runs the four Definition-of-Done scenarios against a real serial port:
 *   1. move_to_angle 45  -> allowed, servo moves, audit hardwareSignalSent=true
 *   2. move_to_angle 200 -> blocked (0-180 limit), servo does not move
 *   3. obstacle closer than minSafeDistance -> legal angle still blocked
 *   4. sensor unplugged / no data -> default-block
 *
 * Usage (requires `npm install serialport` once):
 *   npm run hardware:demo -- --port COM3 [--baud 115200] [--min-safe-cm 10]
 *
 * Scenarios 3 and 4 need physical setup (hold an object close to the sensor /
 * unplug the sensor); the script tells you what to do and reports honestly
 * what it observed. Everything printed here is REAL HARDWARE, not simulation.
 */
import {
  DeviceClockBaseline,
  DistanceInterlock,
  ESP32_SERVO_RIG_CAPABILITIES,
  Esp32DeviceAdapter,
  HardwareExecutionGate,
  SerialEsp32Transport,
  StuckValueDetector,
  buildConservativeMedianReading,
  createNodeSerialPort
} from '../lib/hardware';
import type { InterlockOverride, SensorReading } from '../lib/hardware/types';

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const portPath = argValue('--port');
  if (!portPath) {
    console.error('Missing --port. Example: npm run hardware:demo -- --port COM3');
    process.exit(1);
    return;
  }
  const baudRate = Number(argValue('--baud') ?? 115200);
  const minSafeDistanceCm = Number(argValue('--min-safe-cm') ?? 10);

  // Hysteresis: lock below the threshold, release only 2cm above it, so
  // jitter around the threshold cannot flap the interlock.
  const interlock = new DistanceInterlock({
    lockBelowCm: minSafeDistanceCm,
    releaseAboveCm: minSafeDistanceCm + 2
  });

  // Interlock REQUIREMENTS (age/plausibility/baseline distance) are authoritative
  // in ESP32_SERVO_RIG_CAPABILITIES (audit 2.1). The hysteresis state is only a
  // per-call tightening override: it can raise the safe distance while locked,
  // never lower it below the capability baseline.
  function overrideFor(state: { effectiveMinSafeDistanceCm: number }): InterlockOverride {
    return {
      sensorId: 'hc-sr04',
      minSafeDistanceCm: state.effectiveMinSafeDistanceCm
    };
  }

  console.log('=== REAL HARDWARE MODE — this is NOT simulation ===');
  console.log(`Opening serial port ${portPath} @ ${baudRate}...`);
  const transport = new SerialEsp32Transport(createNodeSerialPort(portPath, baudRate), {
    requestTimeoutMs: 3000
  });
  await transport.connect();
  console.log('Serial connected.');

  const adapter = new Esp32DeviceAdapter(transport, ESP32_SERVO_RIG_CAPABILITIES);
  const gate = new HardwareExecutionGate(adapter);

  // audit 2.2: device-clock baseline + frozen-sensor detector (N=5). The
  // detector only flags frozen when the value is stuck AND the device clock
  // stops advancing; a real static object keeps a live clock and is not flagged.
  const clockBaseline = new DeviceClockBaseline();
  const stuckDetector = new StuckValueDetector({ sampleWindow: 5 });

  async function freshReadings(): Promise<{ readings: SensorReading[]; override: InterlockOverride; frozenSensorIds: Set<string> }> {
    // Median of 5 samples rejects single-sample HC-SR04 noise spikes; the same
    // 5 raw samples feed the frozen-sensor detector (value + device clock).
    const validReadings: SensorReading[] = [];
    let frozen = false;
    const readErrors = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const result = await adapter.readDistanceDetailed('hc-sr04');
      const reading = result.reading;
      if (result.error) readErrors.add(result.error);
      if (reading) {
        validReadings.push(reading);
        if (typeof reading.deviceTimestampMs === 'number') {
          if (!clockBaseline.established()) clockBaseline.establish(reading.deviceTimestampMs);
          clockBaseline.update(reading.deviceTimestampMs);
          frozen = stuckDetector.push(reading.value, reading.deviceTimestampMs);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    const frozenSensorIds = frozen ? new Set<string>(['hc-sr04']) : new Set<string>();
    if (frozen) {
      console.log('[sensor] FROZEN — value stuck and device clock not advancing; actuation blocked until reset');
    }
    const conditionedReading = buildConservativeMedianReading(validReadings);
    const median = conditionedReading?.value ?? null;
    const state = interlock.update(median);
    if (median === null || !conditionedReading) {
      const diagnostic = readErrors.size > 0 ? Array.from(readErrors).join('; ') : 'no valid samples';
      console.log(`[sensor] no distance data: ${diagnostic}`);
      console.log('[sensor] check HC-SR04 5V/GND, shared ESP32 ground, TRIG GPIO 5, ECHO GPIO 4 through a voltage divider, and place a target 2–400 cm away');
      console.log('[sensor] actuation will default-block until a valid reading is received');
      return { readings: [], override: overrideFor(state), frozenSensorIds };
    }
    console.log(`[sensor] median distance = ${median} cm (5 samples) | interlock ${state.locked ? 'LOCKED' : 'clear'} | effective min safe = ${state.effectiveMinSafeDistanceCm} cm`);
    return { readings: [conditionedReading], override: overrideFor(state), frozenSensorIds };
  }

  async function runScenario(label: string, angle: number) {
    console.log(`\n--- ${label} ---`);
    const { readings, override, frozenSensorIds } = await freshReadings();
    const outcome = await gate.run({
      command: {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        deviceId: 'esp32-servo-rig',
        capabilityId: 'move_to_angle',
        args: { angle }
      },
      capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
      sensorReadings: readings,
      interlockOverrides: [override],
      frozenSensorIds
    });
    console.log(`[REAL HARDWARE] status=${outcome.status} reason=${outcome.reason}`);
    console.log(`[REAL HARDWARE] signalSent=${outcome.result.signalSent} detail=${outcome.result.detail}`);
  }

  const scenario = argValue('--scenario') ?? 'all';

  if (scenario === 'all' || scenario === '1') {
    // Park at 0° first THROUGH THE SAME GATE (no bypass), so the following
    // 45° command produces a visible sweep even when the servo already sat
    // at 45° from a previous run. Both commands are gated and audited.
    await runScenario('Scenario 1 (prep): park servo at 0° through the same safety gate', 0);
    await new Promise((resolve) => setTimeout(resolve, 800));
    await runScenario('Scenario 1: rotate servo to 45° (expect: executed, servo visibly sweeps from 0°)', 45);
  }
  if (scenario === 'all' || scenario === '2') {
    await runScenario('Scenario 2: rotate servo to 200° (expect: BLOCKED, servo must NOT move)', 200);
  }
  if (scenario === '3') {
    console.log(`\nHold an object closer than ${minSafeDistanceCm} cm to the sensor, then observe:`);
    await runScenario('Scenario 3: legal angle with obstacle too close (expect: BLOCKED by sensor policy)', 45);
  }
  if (scenario === '4') {
    console.log('\nUnplug the HC-SR04 sensor first, then observe:');
    await runScenario('Scenario 4: sensor missing/disconnected (expect: BLOCKED, default-block)', 45);
  }
  if (scenario === 'all') {
    console.log('\nScenarios 3 and 4 need physical setup. Run them explicitly:');
    console.log('  npm run hardware:demo -- --port ' + portPath + ' --scenario 3   (hold object < ' + minSafeDistanceCm + ' cm)');
    console.log('  npm run hardware:demo -- --port ' + portPath + ' --scenario 4   (unplug the sensor)');
  }

  console.log('\n=== Audit log export (every entry carries hardwareSignalSent) ===');
  console.log(gate.getAuditLog().exportJson());

  await transport.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
