/**
 * Virtual serial loopback acceptance e2e (freeze-compatible: acceptance
 * tooling). Runs the four Definition-of-Done scenarios end-to-end through the
 * REAL production chain — HardwareExecutionGate -> SafetyMonitor ->
 * Esp32DeviceAdapter -> SerialEsp32Transport (real newline-JSON protocol,
 * real ticket enforcement) — against an in-process firmware emulator that
 * mimics esp32-realitywarden v0.1.4 semantics.
 *
 * This does NOT replace physical acceptance (no real servo, no real echo
 * physics). It proves the entire HOST side of the acceptance path, so that a
 * failure on the bench isolates to firmware/wiring/power, never host code.
 *
 * Scenarios (mirrors docs/REAL_HARDWARE_ESP32.md):
 *   1. move_to_angle 45, healthy sensor  => executed, servo state changes
 *   2. move_to_angle 200                 => blocked, ZERO frames on the wire
 *   3. obstacle closer than min-safe     => blocked (interlock)
 *   4. sensor unplugged (no echo)        => blocked (default-block)
 *   5. legacy firmware without deviceMs  => blocked (audit 2.2)
 */
import { Esp32DeviceAdapter, ESP32_SERVO_RIG_CAPABILITIES } from '../../lib/hardware/Esp32DeviceAdapter';
import { HardwareExecutionGate } from '../../lib/hardware/HardwareExecutionGate';
import { SerialEsp32Transport } from '../../lib/hardware/SerialEsp32Transport';
import type { SerialPortLike } from '../../lib/hardware/SerialEsp32Transport';
import type { HardwareCommand, SensorReading } from '../../lib/hardware/types';
import { RuntimeAuditLog } from '../../lib/runtime/RuntimeAuditLog';
import { SafetyMonitor } from '../../lib/runtime/SafetyMonitor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/**
 * In-process firmware emulator speaking the esp32-realitywarden protocol over
 * a SerialPortLike. Responses are delivered asynchronously and split across
 * chunks to exercise the transport's real buffering path.
 */
class VirtualEsp32Port implements SerialPortLike {
  /** Servo state as the firmware would hold it; null until first command. */
  servoAngle: number | null = null;
  /** Physical distance in front of the sensor; null = unplugged (no echo). */
  distanceCm: number | null = 42;
  /** false emulates legacy firmware that predates audit 2.2 (no deviceMs). */
  reportDeviceMs = true;
  /** Wire-level log: every move_to_angle frame that reached the "firmware". */
  moveFramesReceived = 0;

  private opened = false;
  private rxBuffer = '';
  private readonly startedAt = Date.now();
  private readonly dataListeners: Array<(chunk: string) => void> = [];
  private readonly closeListeners: Array<() => void> = [];

  async open() { this.opened = true; }
  async close() {
    this.opened = false;
    this.closeListeners.forEach((listener) => listener());
  }
  isOpen() { return this.opened; }
  onData(listener: (chunk: string) => void) { this.dataListeners.push(listener); }
  onClose(listener: () => void) { this.closeListeners.push(listener); }

  async write(chunk: string) {
    if (!this.opened) throw new Error('port not open');
    this.rxBuffer += chunk;
    let newline = this.rxBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = this.rxBuffer.slice(0, newline).trim();
      this.rxBuffer = this.rxBuffer.slice(newline + 1);
      if (line.length > 0) this.handleLine(line);
      newline = this.rxBuffer.indexOf('\n');
    }
  }

  private millis(): number {
    return Date.now() - this.startedAt + 5000; // firmware uptime, always > 0
  }

  private respond(payload: Record<string, unknown>) {
    const line = `${JSON.stringify(payload)}\n`;
    const mid = Math.floor(line.length / 2);
    // Async + chunk-split delivery, like a real serial stream.
    setTimeout(() => this.dataListeners.forEach((listener) => listener(line.slice(0, mid))), 0);
    setTimeout(() => this.dataListeners.forEach((listener) => listener(line.slice(mid))), 1);
  }

  private handleLine(line: string) {
    let frame: { id?: string; cmd?: string; args?: { angle?: number } };
    try {
      frame = JSON.parse(line) as typeof frame;
    } catch {
      this.respond({ id: 'unknown', ok: false, detail: 'malformed json' });
      return;
    }
    const id = frame.id ?? 'unknown';
    if (frame.cmd === 'move_to_angle') {
      this.moveFramesReceived += 1;
      const angle = frame.args?.angle;
      if (typeof angle !== 'number' || Number.isNaN(angle)) {
        this.respond({ id, ok: false, detail: 'missing numeric args.angle' });
        return;
      }
      if (angle < 0 || angle > 180) {
        // Firmware last line of defense: refuse, never clamp.
        this.respond({ id, ok: false, detail: 'angle outside 0-180 refused by firmware' });
        return;
      }
      this.servoAngle = angle;
      this.respond({ id, ok: true, data: { angle } });
      return;
    }
    if (frame.cmd === 'read_distance') {
      if (this.distanceCm === null) {
        // Honest failure, never a fake reading.
        this.respond({ id, ok: false, detail: 'no echo pulse (sensor disconnected, underpowered, or target out of range)' });
        return;
      }
      const data: Record<string, unknown> = {
        distanceCm: this.distanceCm,
        echoDurationUs: Math.round(this.distanceCm * 58)
      };
      if (this.reportDeviceMs) data.deviceMs = this.millis();
      this.respond({ id, ok: true, data });
      return;
    }
    this.respond({ id, ok: false, detail: 'unsupported cmd' });
  }
}

function servoCommand(angle: number): HardwareCommand {
  return {
    id: `e2e-${angle}-${Math.random().toString(36).slice(2, 8)}`,
    deviceId: 'esp32-servo-rig',
    capabilityId: 'move_to_angle',
    args: { angle }
  };
}

/** Sample the sensor through the REAL adapter+transport, like the demo does. */
async function sampleReadings(adapter: Esp32DeviceAdapter, samples = 3): Promise<SensorReading[]> {
  const readings: SensorReading[] = [];
  for (let index = 0; index < samples; index += 1) {
    const reading = await adapter.readDistance('hc-sr04');
    if (reading) readings.push(reading);
  }
  return readings;
}

async function main() {
  const port = new VirtualEsp32Port();
  const transport = new SerialEsp32Transport(port, { requestTimeoutMs: 1000 });
  const adapter = new Esp32DeviceAdapter(transport, ESP32_SERVO_RIG_CAPABILITIES);
  const audit = new RuntimeAuditLog();
  const gate = new HardwareExecutionGate(adapter, new SafetyMonitor(), audit);
  await transport.connect();

  // --- Scenario 1: legal angle + healthy sensor => executed on the wire ---
  let readings = await sampleReadings(adapter);
  assert(readings.length === 3, 'healthy sensor must produce 3 readings through the real transport');
  assert(readings.every((reading) => typeof reading.deviceTimestampMs === 'number'), 'v0.1.4 emulation must carry deviceMs');
  const executed = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: readings
  });
  assert(executed.status === 'executed', `scenario 1 must execute, got ${executed.status} (${executed.reason})`);
  assert(executed.result.signalSent === true, 'scenario 1 must report signalSent=true');
  assert(port.servoAngle === 45, `virtual servo must move to 45, got ${port.servoAngle}`);
  console.log('ok - scenario 1: executed, virtual servo moved to 45');

  // --- Scenario 2: out-of-range angle => blocked with ZERO wire frames ---
  const movesBefore = port.moveFramesReceived;
  const blocked = await gate.run({
    command: servoCommand(200),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: await sampleReadings(adapter)
  });
  assert(blocked.status === 'blocked', 'scenario 2: angle 200 must be blocked');
  assert(blocked.reason.indexOf('angle_out_of_range') === 0, `scenario 2 reason must be angle_out_of_range, got ${blocked.reason}`);
  assert(port.moveFramesReceived === movesBefore, 'scenario 2: ZERO move_to_angle frames may reach the wire');
  assert(port.servoAngle === 45, 'scenario 2: virtual servo must not move');
  console.log('ok - scenario 2: blocked, zero actuation frames on the wire');

  // --- Scenario 3: obstacle inside min safe distance => interlock blocks ---
  port.distanceCm = 5; // closer than the authoritative 10cm minSafeDistanceCm
  readings = await sampleReadings(adapter);
  const interlocked = await gate.run({
    command: servoCommand(90),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: readings
  });
  assert(interlocked.status === 'blocked', 'scenario 3: close obstacle must block actuation');
  assert(
    interlocked.reason.indexOf('min_safe_distance_violation') === 0,
    `scenario 3 reason must be min_safe_distance_violation, got ${interlocked.reason}`
  );
  assert(port.moveFramesReceived === movesBefore, 'scenario 3: no actuation frame on the wire');
  assert(port.servoAngle === 45, 'scenario 3: virtual servo must not move');
  console.log('ok - scenario 3: min-safe-distance interlock blocked actuation');

  // --- Scenario 4: sensor unplugged => honest failure => default-block ---
  port.distanceCm = null;
  readings = await sampleReadings(adapter);
  assert(readings.length === 0, 'unplugged sensor must yield zero readings (fail-closed null, no fake values)');
  const missing = await gate.run({
    command: servoCommand(90),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: readings
  });
  assert(missing.status === 'blocked', 'scenario 4: missing sensor data must default-block');
  assert(missing.reason.indexOf('sensor_missing') === 0, `scenario 4 reason must be sensor_missing, got ${missing.reason}`);
  assert(port.moveFramesReceived === movesBefore, 'scenario 4: no actuation frame on the wire');
  console.log('ok - scenario 4: sensor missing default-blocked actuation');

  // --- Scenario 5 (audit 2.2): legacy firmware without deviceMs => blocked ---
  port.distanceCm = 42;
  port.reportDeviceMs = false;
  readings = await sampleReadings(adapter);
  assert(readings.length === 3 && readings.every((reading) => reading.deviceTimestampMs === undefined),
    'legacy emulation must produce readings without deviceTimestampMs');
  const legacy = await gate.run({
    command: servoCommand(90),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: readings
  });
  assert(legacy.status === 'blocked', 'scenario 5: missing device timestamp must block actuation');
  assert(
    legacy.reason.indexOf('device_timestamp_unavailable') === 0,
    `scenario 5 reason must be device_timestamp_unavailable, got ${legacy.reason}`
  );
  console.log('ok - scenario 5: legacy firmware (no deviceMs) blocked, matching the reflash warning');

  // --- Audit log integrity across the whole run ---
  const entries = audit.list();
  const executedEntries = entries.filter((entry) => entry.code === 'hardware_command_executed');
  const blockedEntries = entries.filter((entry) => entry.code === 'hardware_command_blocked');
  assert(executedEntries.length === 1, `exactly one executed audit entry expected, got ${executedEntries.length}`);
  assert(blockedEntries.length === 4, `four blocked audit entries expected, got ${blockedEntries.length}`);
  assert(entries.every((entry) => typeof entry.hardwareSignalSent === 'boolean'), 'every audit entry must carry hardwareSignalSent');
  assert(blockedEntries.every((entry) => entry.hardwareSignalSent === false), 'blocked entries must have hardwareSignalSent=false');
  assert(entries.every((entry) => entry.hardwareSignalSent === (entry.hardwareSignalState !== 'not_sent')), 'signal boolean/state evidence must agree');
  assert(executedEntries[0].hardwareSignalState === 'device_acknowledged', 'executed entry requires device acknowledgement');
  assert(executedEntries[0].data?.executionEvidence === 'command_acknowledged_open_loop', 'servo acknowledgement must stay explicitly open-loop');
  assert(executedEntries[0].data?.physicalOutcomeVerified === false, 'virtual firmware acknowledgement must not claim physical verification');
  console.log('ok - audit log: delivery state explicit; acknowledgement remains open-loop, never physical proof');

  await transport.disconnect();
  console.log('Virtual loopback acceptance e2e passed (5 scenarios, real transport + protocol).');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
