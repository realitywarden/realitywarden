/**
 * REAL HARDWARE demo / acceptance runner (ESP32 DevKit + SG90 + HC-SR04).
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
  DistanceInterlock,
  ESP32_SERVO_RIG_CAPABILITIES,
  Esp32DeviceAdapter,
  HardwareExecutionGate,
  MedianFilter,
  SerialEsp32Transport,
  createNodeSerialPort
} from '../lib/hardware';
import type { SensorReading, SensorSafetyPolicy } from '../lib/hardware/types';

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

  function policyFor(state: { effectiveMinSafeDistanceCm: number }): SensorSafetyPolicy {
    return {
      sensorId: 'hc-sr04',
      maxAgeMs: 1500,
      minPlausibleValue: 2,
      maxPlausibleValue: 400,
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

  async function freshReadings(): Promise<{ readings: SensorReading[]; policy: SensorSafetyPolicy }> {
    // Median of 5 samples rejects single-sample HC-SR04 noise spikes.
    const filter = new MedianFilter(5);
    let lastReading: SensorReading | null = null;
    for (let i = 0; i < 5; i += 1) {
      const reading = await adapter.readDistance('hc-sr04');
      if (reading) {
        filter.push(reading.value);
        lastReading = reading;
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    const median = filter.median();
    const state = interlock.update(median);
    if (median === null || !lastReading) {
      console.log('[sensor] no distance data (missing/disconnected) — actuation will default-block');
      return { readings: [], policy: policyFor(state) };
    }
    console.log(`[sensor] median distance = ${median} cm (5 samples) | interlock ${state.locked ? 'LOCKED' : 'clear'} | effective min safe = ${state.effectiveMinSafeDistanceCm} cm`);
    return { readings: [{ ...lastReading, value: median, timestampMs: Date.now() }], policy: policyFor(state) };
  }

  async function runScenario(label: string, angle: number) {
    console.log(`\n--- ${label} ---`);
    const { readings, policy } = await freshReadings();
    const outcome = await gate.run({
      command: {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        deviceId: 'esp32-servo-rig',
        capabilityId: 'move_to_angle',
        args: { angle }
      },
      capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
      sensorReadings: readings,
      sensorPolicies: [policy]
    });
    console.log(`[REAL HARDWARE] status=${outcome.status} reason=${outcome.reason}`);
    console.log(`[REAL HARDWARE] signalSent=${outcome.result.signalSent} detail=${outcome.result.detail}`);
  }

  const scenario = argValue('--scenario') ?? 'all';

  if (scenario === 'all' || scenario === '1') {
    await runScenario('Scenario 1: rotate servo to 45° (expect: executed, servo moves)', 45);
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
