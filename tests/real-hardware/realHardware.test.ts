/**
 * Safety invariant tests for the real-hardware execution path.
 *
 * These are behavioral spy/mock tests, not documentation checks:
 * - blocked command  => adapter.execute() call count === 0 AND zero frames on the wire
 * - sensor missing / stale / invalid => actuation blocked (default-block)
 * - distance below minSafeDistance   => actuation blocked
 * - transport offline => signalSent:false + "hardware offline", never fake success
 * - every audit entry carries an explicit hardwareSignalSent boolean
 */
import { Esp32DeviceAdapter, ESP32_SERVO_RIG_CAPABILITIES } from '../../lib/hardware/Esp32DeviceAdapter';
import { HardwareExecutionGate } from '../../lib/hardware/HardwareExecutionGate';
import { TransportOfflineError } from '../../lib/hardware/RealDeviceTransport';
import type { RealDeviceTransport } from '../../lib/hardware/RealDeviceTransport';
import { SerialEsp32Transport } from '../../lib/hardware/SerialEsp32Transport';
import type { SerialPortLike } from '../../lib/hardware/SerialEsp32Transport';
import type {
  HardwareCommand,
  SensorReading,
  TransportFrame,
  TransportResponse
} from '../../lib/hardware/types';
import { RuntimeAuditLog } from '../../lib/runtime/RuntimeAuditLog';
import { SafetyMonitor } from '../../lib/runtime/SafetyMonitor';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

/** Transport spy: records every frame that would reach the wire. */
class FakeTransport implements RealDeviceTransport {
  sentFrames: TransportFrame[] = [];
  private connected = false;

  constructor(private readonly respond: (frame: TransportFrame) => TransportResponse = (frame) => ({
    id: frame.id,
    ok: true,
    data: frame.cmd === 'read_distance' ? { distanceCm: 42 } : { angle: frame.args?.angle }
  })) {}

  async connect() { this.connected = true; }
  async disconnect() { this.connected = false; }
  isConnected() { return this.connected; }

  async send(frame: TransportFrame): Promise<TransportResponse> {
    if (!this.connected) throw new TransportOfflineError();
    this.sentFrames.push(frame);
    return this.respond(frame);
  }
}

/** Adapter spy: counts every execute() invocation. */
class SpyAdapter extends Esp32DeviceAdapter {
  executeCalls = 0;
  async execute(command: HardwareCommand) {
    this.executeCalls += 1;
    return super.execute(command);
  }
}

const NOW = 1_750_000_000_000;

// Interlock requirements now live authoritatively in ESP32_SERVO_RIG_CAPABILITIES
// (audit 2.1): hc-sr04, maxAgeMs 1500, plausible 2..400, baseline minSafe 10.
// Tests therefore pass readings (and, where relevant, tightening overrides)
// but never assemble the interlock policy themselves.

const DEVICE_MS = 500_000; // ESP32 millis() baseline for tests

function reading(value: number, ageMs = 0, deviceMs: number = DEVICE_MS): SensorReading {
  return {
    sensorId: 'hc-sr04',
    capabilityId: 'read_distance',
    value,
    unit: 'cm',
    timestampMs: NOW - ageMs,
    deviceTimestampMs: deviceMs
  };
}

// A reading from legacy firmware that does not report a device-side timestamp.
function readingNoDeviceTs(value: number, ageMs = 0): SensorReading {
  return {
    sensorId: 'hc-sr04',
    capabilityId: 'read_distance',
    value,
    unit: 'cm',
    timestampMs: NOW - ageMs
    // deviceTimestampMs intentionally omitted
  };
}

function servoCommand(angle: number): HardwareCommand {
  return {
    id: `cmd-${angle}-${Math.random().toString(36).slice(2, 8)}`,
    deviceId: 'esp32-servo-rig',
    capabilityId: 'move_to_angle',
    args: { angle }
  };
}

function buildGate(transport: FakeTransport) {
  const adapter = new SpyAdapter(transport, ESP32_SERVO_RIG_CAPABILITIES);
  const audit = new RuntimeAuditLog();
  const gate = new HardwareExecutionGate(adapter, new SafetyMonitor(), audit);
  return { adapter, audit, gate };
}

async function testBlockedNeverReachesHardware() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, audit, gate } = buildGate(transport);

  // Out-of-range angle (limit is 0..180) with perfectly healthy sensors.
  const outcome = await gate.run({
    command: servoCommand(200),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });

  assert(outcome.status === 'blocked', 'angle 200 must be blocked');
  assert(adapter.executeCalls === 0, 'blocked command must NOT invoke adapter.execute() (call count must be 0)');
  assert(transport.sentFrames.length === 0, 'blocked command must put zero frames on the wire');
  assert(outcome.result.signalSent === false, 'blocked outcome must report signalSent=false');

  const entries = audit.list();
  const blockedEntry = entries.find((entry) => entry.code === 'hardware_command_blocked');
  assert(blockedEntry, 'block decision must be written to the audit log');
  assert(blockedEntry.hardwareSignalSent === false, 'blocked audit entry must have hardwareSignalSent=false');

  // Negative angle must also be blocked without reaching hardware.
  const negative = await gate.run({
    command: servoCommand(-5),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });
  assert(negative.status === 'blocked', 'angle -5 must be blocked');
  assert(adapter.executeCalls === 0, 'adapter.execute() call count must stay 0 after second blocked command');
}

async function testSensorMissingDefaultBlocks() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [], // no data at all
    nowMs: NOW
  });

  assert(outcome.status === 'blocked', 'missing sensor data must default-block actuation');
  assert(outcome.reason.indexOf('sensor_missing') === 0, `reason must be sensor_missing, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'missing-sensor block must not reach adapter.execute()');
}

async function testSensorStaleDefaultBlocks() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100, 5000)], // 5s old, maxAgeMs=1000
    nowMs: NOW
  });

  assert(outcome.status === 'blocked', 'stale sensor data must default-block actuation');
  assert(outcome.reason.indexOf('sensor_stale') === 0, `reason must be sensor_stale, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'stale-sensor block must not reach adapter.execute()');
}

async function testSensorInvalidDefaultBlocks() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  for (const badValue of [9999, 0.5, NaN]) {
    const outcome = await gate.run({
      command: servoCommand(45),
      capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
      sensorReadings: [reading(badValue)],
        nowMs: NOW
    });
    assert(outcome.status === 'blocked', `implausible sensor value ${badValue} must default-block actuation`);
    assert(outcome.reason.indexOf('sensor_invalid') === 0, `reason must be sensor_invalid, got: ${outcome.reason}`);
  }
  assert(adapter.executeCalls === 0, 'invalid-sensor blocks must not reach adapter.execute()');
}

async function testMinSafeDistanceInterlock() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  // Legal angle, fresh + plausible reading, but obstacle too close (5cm < 10cm).
  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(5)],
    nowMs: NOW
  });

  assert(outcome.status === 'blocked', 'distance below minSafeDistance must block actuation');
  assert(
    outcome.reason.indexOf('min_safe_distance_violation') === 0,
    `reason must be min_safe_distance_violation, got: ${outcome.reason}`
  );
  assert(adapter.executeCalls === 0, 'min-safe-distance block must not reach adapter.execute()');
}

async function testOfflineTransportNeverFakesSuccess() {
  const transport = new FakeTransport();
  // NOT connected on purpose.
  const { adapter, audit, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });

  assert(outcome.status === 'failed', 'offline hardware must fail, not fake success');
  assert(outcome.result.ok === false, 'offline result.ok must be false');
  assert(outcome.result.signalSent === false, 'offline result.signalSent must be false');
  assert(outcome.result.detail === 'hardware offline', `offline detail must be "hardware offline", got: ${outcome.result.detail}`);
  assert(adapter.executeCalls === 1, 'allowed command reaches the adapter, which then reports offline honestly');
  assert(transport.sentFrames.length === 0, 'offline transport must not record any sent frame');

  const failedEntry = audit.list().find((entry) => entry.code === 'hardware_command_failed');
  assert(failedEntry, 'offline failure must be audited');
  assert(failedEntry.hardwareSignalSent === false, 'offline audit entry must have hardwareSignalSent=false');
}

async function testAllowedCommandExecutesAndAudits() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, audit, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });

  assert(outcome.status === 'executed', 'legal command with healthy sensors must execute');
  assert(outcome.executionMode === 'real_hardware', 'outcome must be labeled real_hardware');
  assert(outcome.result.signalSent === true, 'executed result must report signalSent=true');
  assert(adapter.executeCalls === 1, 'allowed command must invoke adapter.execute() exactly once');
  assert(transport.sentFrames.length === 1, 'exactly one frame must reach the wire');
  assert(transport.sentFrames[0].cmd === 'move_to_angle', 'wire frame must carry move_to_angle');
  assert(transport.sentFrames[0].args?.angle === 45, 'wire frame must carry angle=45');

  const executedEntry = audit.list().find((entry) => entry.code === 'hardware_command_executed');
  assert(executedEntry, 'executed decision must be audited');
  assert(executedEntry.hardwareSignalSent === true, 'executed audit entry must have hardwareSignalSent=true');
}

async function testReadsAllowedWhileActuationLockedOut() {
  const transport = new FakeTransport();
  await transport.connect();
  const { gate } = buildGate(transport);

  // Sensor data missing: actuation is locked out, but a read_distance command
  // (non-actuation) may pass so the operator can re-establish observability.
  const outcome = await gate.run({
    command: {
      id: 'read-1',
      deviceId: 'esp32-servo-rig',
      capabilityId: 'read_distance',
      args: {}
    },
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [],
    nowMs: NOW
  });

  assert(outcome.status === 'executed', 'read_distance must stay available while actuation is locked out');
}

async function testUnsupportedCapabilityFailsLoudly() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: {
      id: 'bogus-1',
      deviceId: 'esp32-servo-rig',
      capabilityId: 'launch_rocket' as never,
      args: {}
    },
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });

  assert(outcome.status === 'blocked', 'unsupported capability must be blocked, never guessed');
  assert(outcome.reason.indexOf('unsupported_capability') === 0, 'reason must name the unsupported capability');
  assert(adapter.executeCalls === 0, 'unsupported capability must not reach adapter.execute()');
  assert(transport.sentFrames.length === 0, 'unsupported capability must put zero frames on the wire');
}

async function testEveryAuditEntryCarriesHardwareSignalSent() {
  const transport = new FakeTransport();
  await transport.connect();
  const { audit, gate } = buildGate(transport);

  await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });
  await gate.run({
    command: servoCommand(200),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    nowMs: NOW
  });
  audit.info('input', 'note', 'plain info entry');

  const entries = audit.list();
  assert(entries.length >= 3, 'audit log must contain the recorded entries');
  for (const entry of entries) {
    assert(
      typeof entry.hardwareSignalSent === 'boolean',
      `every audit entry must carry boolean hardwareSignalSent (entry ${entry.code})`
    );
  }

  const exported = JSON.parse(audit.exportJson()) as Array<Record<string, unknown>>;
  assert(exported.length === entries.length, 'exportJson must contain every entry');
  for (const entry of exported) {
    assert(
      typeof entry.hardwareSignalSent === 'boolean',
      'exported audit entries must carry boolean hardwareSignalSent'
    );
  }
}

/** Fake serial port for SerialEsp32Transport protocol tests. */
class FakeSerialPort implements SerialPortLike {
  written: string[] = [];
  private opened = false;
  private dataListeners: Array<(chunk: string) => void> = [];
  private closeListeners: Array<() => void> = [];
  autoRespond: ((line: string) => string | null) | null = null;

  async open() { this.opened = true; }
  async close() {
    this.opened = false;
    this.closeListeners.forEach((listener) => listener());
  }
  async write(chunk: string) {
    if (!this.opened) throw new Error('port not open');
    this.written.push(chunk);
    if (this.autoRespond) {
      const response = this.autoRespond(chunk.trim());
      if (response !== null) {
        // Deliver asynchronously and split across chunks to exercise buffering.
        const mid = Math.floor(response.length / 2);
        setTimeout(() => this.emitData(response.slice(0, mid)), 0);
        setTimeout(() => this.emitData(response.slice(mid)), 1);
      }
    }
  }
  onData(listener: (chunk: string) => void) { this.dataListeners.push(listener); }
  onClose(listener: () => void) { this.closeListeners.push(listener); }
  isOpen() { return this.opened; }
  emitData(chunk: string) { this.dataListeners.forEach((listener) => listener(chunk)); }
}

async function testSerialTransportProtocol() {
  const port = new FakeSerialPort();
  port.autoRespond = (line) => {
    const frame = JSON.parse(line) as TransportFrame;
    return `${JSON.stringify({ id: frame.id, ok: true, data: { angle: frame.args?.angle } })}\n`;
  };
  const transport = new SerialEsp32Transport(port, { requestTimeoutMs: 500 });

  // Sending before connect must throw offline, not write anything.
  let threw = false;
  try {
    await transport.send({ id: 'x1', cmd: 'move_to_angle', args: { angle: 10 } });
  } catch (error) {
    threw = error instanceof TransportOfflineError;
  }
  assert(threw, 'send before connect must throw TransportOfflineError');
  const writtenBeforeConnect: number = port.written.length;
  assert(writtenBeforeConnect === 0, 'nothing may be written before connect');

  await transport.connect();
  const response = await transport.send({ id: 'x2', cmd: 'move_to_angle', args: { angle: 90 } });
  assert(response.ok === true, 'serial round-trip must succeed');
  assert(response.id === 'x2', 'response must be matched by id');
  const writtenAfterSend: number = port.written.length;
  assert(writtenAfterSend === 1 && port.written[0].indexOf('"move_to_angle"') >= 0, 'frame must be written as JSON line');

  // Malformed line must be recorded as protocol error, not treated as success.
  port.autoRespond = null;
  const pendingTimeout = transport.send({ id: 'x3', cmd: 'read_distance' }).then(
    () => { throw new Error('timeout expected'); },
    (error: Error) => error
  );
  port.emitData('not-json\n');
  const timeoutError = await pendingTimeout;
  assert(timeoutError.message.indexOf('timeout') >= 0, 'unanswered request must time out');
  assert(
    (transport.getLastProtocolError() ?? '').indexOf('malformed') >= 0,
    'malformed device line must be surfaced as protocol error'
  );

  // Port close must fail pending requests and flip connectivity.
  await transport.disconnect();
  assert(transport.isConnected() === false, 'disconnect must report not connected');
}

async function testMedianFilterRejectsNoise() {
  const { MedianFilter } = await import('../../lib/hardware/SensorConditioning');
  const filter = new MedianFilter(5);
  assert(filter.median() === null, 'empty filter must report null (fail closed), never a fake value');
  filter.push(100);
  filter.push(101);
  filter.push(3);    // noise spike downward
  filter.push(99);
  const median = filter.push(100);
  assert(median === 100, `median of [100,101,3,99,100] must be 100, got ${median}`);
  filter.push(NaN);
  assert(filter.median() === 100, 'NaN samples must be rejected, not poison the window');
}

async function testDistanceInterlockHysteresis() {
  const { DistanceInterlock } = await import('../../lib/hardware/SensorConditioning');
  const interlock = new DistanceInterlock({ lockBelowCm: 10, releaseAboveCm: 12 });

  let state = interlock.update(20);
  assert(state.locked === false, 'clear distance must not lock');
  assert(state.effectiveMinSafeDistanceCm === 10, 'unlocked threshold must equal lockBelowCm');

  state = interlock.update(9);
  assert(state.locked === true, 'distance below lockBelowCm must lock');
  assert(state.effectiveMinSafeDistanceCm === 12, 'locked threshold must rise to releaseAboveCm');

  state = interlock.update(10.5); // inside hysteresis band
  assert(state.locked === true, 'inside the band the interlock must STAY locked (no flapping)');

  state = interlock.update(11.9); // still inside band
  assert(state.locked === true, '11.9 < releaseAboveCm must stay locked');

  state = interlock.update(12.1);
  assert(state.locked === false, 'above releaseAboveCm must unlock');

  state = interlock.update(11); // band again, now from unlocked side
  assert(state.locked === false, 'inside the band from the unlocked side must stay unlocked');

  state = interlock.update(null);
  assert(state.locked === true, 'missing data must lock (fail closed)');

  // Conservativeness invariant: effective threshold never below lockBelowCm.
  for (const value of [5, 10.5, 13, null, 8]) {
    state = interlock.update(value as number | null);
    assert(state.effectiveMinSafeDistanceCm >= 10, 'effective threshold must never drop below lockBelowCm');
  }

  let threw = false;
  try {
    // eslint-disable-next-line no-new
    new DistanceInterlock({ lockBelowCm: 10, releaseAboveCm: 10 });
  } catch {
    threw = true;
  }
  assert(threw, 'releaseAboveCm <= lockBelowCm must be rejected at construction');
}

// -- audit 2.1 regression tests --------------------------------------------

async function testEmptyOverridesStillEnforceDeviceInterlock() {
  // THE audit 2.1 gate: the device capability declares a required hc-sr04
  // interlock. The caller supplies NO interlock overrides and NO readings.
  // The command must still be blocked (default-block), with zero hardware
  // signal — the interlock cannot be skipped by omitting caller policy.
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, audit, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: []
    // interlockOverrides intentionally omitted
  });

  assert(outcome.status === 'blocked', 'device-declared interlock must block even with no caller policy');
  assert(outcome.reason.indexOf('sensor_missing') === 0, `reason must be sensor_missing, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'blocked interlock must not reach adapter.execute()');
  assert(transport.sentFrames.length === 0, 'blocked interlock must put zero frames on the wire');
  const blockedEntry = audit.list().find((entry) => entry.code === 'hardware_command_blocked');
  assert(blockedEntry, 'block decision must be audited');
  assert(blockedEntry.hardwareSignalSent === false, 'blocked audit entry must have hardwareSignalSent=false');
}

async function testBaselineInterlockEnforcedWithoutOverride() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  // 11cm > baseline 10cm, fresh + plausible, no override => executes.
  const pass = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(11)],
    nowMs: NOW
  });
  assert(pass.status === 'executed', `11cm above baseline must execute, got ${pass.status}:${pass.reason}`);
  assert(adapter.executeCalls === 1, 'allowed command must reach adapter once');

  // 9cm < baseline 10cm, no override => blocked by the capability baseline.
  const block = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(9)],
    nowMs: NOW
  });
  assert(block.status === 'blocked', 'below-baseline distance must block via capability baseline');
  assert(block.reason.indexOf('min_safe_distance_violation') === 0, `reason must be min_safe_distance_violation, got: ${block.reason}`);
  assert(adapter.executeCalls === 1, 'blocked command must not reach adapter again');
}

async function testInterlockOverrideCanOnlyTighten() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  // Tightening override (15 > baseline 10): 11cm now below the tightened
  // threshold => blocked with min_safe_distance_violation at 15.
  const tightened = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(11)],
    interlockOverrides: [{ sensorId: 'hc-sr04', minSafeDistanceCm: 15 }],
    nowMs: NOW
  });
  assert(tightened.status === 'blocked', 'tighter override must be able to block a reading that passes baseline');
  assert(tightened.reason.indexOf('min_safe_distance_violation') === 0, `reason must be min_safe_distance_violation, got: ${tightened.reason}`);
  assert(tightened.reason.indexOf('min=15') >= 0, `blocked at the tightened threshold, got: ${tightened.reason}`);

  // Loosening override (5 < baseline 10): rejected explicitly, never applied
  // (invariant 3: no silent correction). Caller's raw value preserved in reason.
  const loosened = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(11)],
    interlockOverrides: [{ sensorId: 'hc-sr04', minSafeDistanceCm: 5 }],
    nowMs: NOW
  });
  assert(loosened.status === 'blocked', 'looser override must be rejected, not silently applied');
  assert(loosened.reason.indexOf('invalid_interlock_override') === 0, `reason must be invalid_interlock_override, got: ${loosened.reason}`);
  assert(loosened.reason.indexOf('requested=5') >= 0, `caller raw override value must be preserved in reason, got: ${loosened.reason}`);
  assert(adapter.executeCalls === 0, 'no override case reached the adapter');
}

async function testOverrideForUndeclaredSensorRejected() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    interlockOverrides: [{ sensorId: 'phantom-lidar', minSafeDistanceCm: 50 }],
    nowMs: NOW
  });
  assert(outcome.status === 'blocked', 'override for a sensor the capability does not declare must be rejected');
  assert(outcome.reason.indexOf('invalid_interlock_override') === 0, `reason must be invalid_interlock_override, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'rejected override must not reach adapter.execute()');
}

// -- audit 2.2 regression tests --------------------------------------------

async function testActuationRequiresDeviceTimestamp() {
  // Decision 2: no device-side timestamp => actuation blocked (never a silent
  // fallback to host arrival time). Reads are unaffected (see next test).
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, audit, gate } = buildGate(transport);

  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [readingNoDeviceTs(100)],
    nowMs: NOW
  });
  assert(outcome.status === 'blocked', 'actuation without device timestamp must be blocked');
  assert(outcome.reason.indexOf('device_timestamp_unavailable') === 0, `reason must be device_timestamp_unavailable, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'device_timestamp_unavailable block must not reach adapter.execute()');
  const blockedEntry = audit.list().find((entry) => entry.code === 'hardware_command_blocked');
  assert(blockedEntry && blockedEntry.hardwareSignalSent === false, 'block must be audited with hardwareSignalSent=false');
}

async function testReadsAllowedWithoutDeviceTimestamp() {
  // Reads never actuate, so the device-timestamp requirement does not gate them.
  const transport = new FakeTransport();
  await transport.connect();
  const { gate } = buildGate(transport);

  const outcome = await gate.run({
    command: { id: 'read-x', deviceId: 'esp32-servo-rig', capabilityId: 'read_distance', args: {} },
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [readingNoDeviceTs(100)],
    nowMs: NOW
  });
  assert(outcome.status === 'executed', 'read_distance must stay available even without a device timestamp');
}

async function testFrozenSensorBlocksActuationNotOverridable() {
  const transport = new FakeTransport();
  await transport.connect();
  const { adapter, gate } = buildGate(transport);

  // Healthy-looking reading, but the sensor is latched frozen by the host.
  const outcome = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    frozenSensorIds: new Set(['hc-sr04']),
    nowMs: NOW
  });
  assert(outcome.status === 'blocked', 'frozen sensor must block actuation');
  assert(outcome.reason.indexOf('sensor_frozen') === 0, `reason must be sensor_frozen, got: ${outcome.reason}`);
  assert(adapter.executeCalls === 0, 'frozen block must not reach adapter.execute()');

  // An override cannot un-freeze: sensor_frozen still wins.
  const withOverride = await gate.run({
    command: servoCommand(45),
    capabilityLimits: ESP32_SERVO_RIG_CAPABILITIES,
    sensorReadings: [reading(100)],
    interlockOverrides: [{ sensorId: 'hc-sr04', minSafeDistanceCm: 10 }],
    frozenSensorIds: new Set(['hc-sr04']),
    nowMs: NOW
  });
  assert(withOverride.status === 'blocked' && withOverride.reason.indexOf('sensor_frozen') === 0, 'frozen must not be overridable');
  assert(adapter.executeCalls === 0, 'frozen-with-override must still not reach adapter.execute()');
}

async function testStuckValueDetectorFrozenSemantics() {
  const { StuckValueDetector } = await import('../../lib/hardware/SensorConditioning');

  // Value stuck AND device clock stuck across 5 samples => frozen (latched).
  const stuck = new StuckValueDetector({ sampleWindow: 5 });
  let frozen = false;
  for (let i = 0; i < 5; i += 1) frozen = stuck.push(42, 1000);
  assert(frozen === true, 'identical value + non-advancing clock over the window must latch frozen');
  // Latch persists even when a healthy advancing sample arrives.
  assert(stuck.push(50, 2000) === true, 'frozen must latch until reset, not self-clear');
  stuck.reset();
  assert(stuck.isFrozen() === false, 'reset must clear the frozen latch');

  // Value identical but device clock ADVANCING => a real static object, never frozen.
  const moving = new StuckValueDetector({ sampleWindow: 5 });
  let movingFrozen = false;
  for (let i = 0; i < 6; i += 1) movingFrozen = moving.push(42, 1000 + i * 60);
  assert(movingFrozen === false, 'identical value with a live advancing clock must NOT be flagged frozen');
}

async function testDeviceClockBaseline() {
  const { DeviceClockBaseline } = await import('../../lib/hardware/SensorConditioning');
  const baseline = new DeviceClockBaseline();
  assert(baseline.established() === false, 'baseline starts unestablished');
  assert(baseline.hasAdvanced(1000) === true, 'first sample counts as advanced');
  baseline.establish(1000);
  assert(baseline.established() === true, 'establish sets the baseline');
  assert(baseline.deviceElapsedMs(1300) === 300, 'device elapsed measured from baseline');
  assert(baseline.hasAdvanced(1000) === false, 'a non-advancing device clock is detected');
  baseline.update(1300);
  assert(baseline.hasAdvanced(1300) === false, 'equal timestamp is not an advance');
  assert(baseline.hasAdvanced(1400) === true, 'a larger timestamp is an advance');
  baseline.reset();
  assert(baseline.established() === false, 'reset clears the baseline');
}

async function main() {
  const tests: Array<[string, () => Promise<void>]> = [
    ['blocked command never reaches hardware', testBlockedNeverReachesHardware],
    ['sensor missing => default-block', testSensorMissingDefaultBlocks],
    ['sensor stale => default-block', testSensorStaleDefaultBlocks],
    ['sensor invalid => default-block', testSensorInvalidDefaultBlocks],
    ['min safe distance interlock blocks actuation', testMinSafeDistanceInterlock],
    ['offline transport never fakes success', testOfflineTransportNeverFakesSuccess],
    ['allowed command executes with signalSent=true', testAllowedCommandExecutesAndAudits],
    ['reads stay available while actuation locked out', testReadsAllowedWhileActuationLockedOut],
    ['unsupported capability fails loudly', testUnsupportedCapabilityFailsLoudly],
    ['every audit entry carries hardwareSignalSent', testEveryAuditEntryCarriesHardwareSignalSent],
    ['audit 2.1: empty caller policy + device interlock => blocked, zero signal', testEmptyOverridesStillEnforceDeviceInterlock],
    ['audit 2.1: capability baseline interlock enforced without override', testBaselineInterlockEnforcedWithoutOverride],
    ['audit 2.1: interlock override can only tighten, loosening rejected', testInterlockOverrideCanOnlyTighten],
    ['audit 2.1: override for undeclared sensor rejected', testOverrideForUndeclaredSensorRejected],
    ['audit 2.2: actuation requires a device-side timestamp', testActuationRequiresDeviceTimestamp],
    ['audit 2.2: reads allowed without a device timestamp', testReadsAllowedWithoutDeviceTimestamp],
    ['audit 2.2: frozen sensor blocks actuation and is not overridable', testFrozenSensorBlocksActuationNotOverridable],
    ['audit 2.2: stuck-value detector frozen semantics (value+clock)', testStuckValueDetectorFrozenSemantics],
    ['audit 2.2: device clock baseline advance/elapsed/reset', testDeviceClockBaseline],
    ['serial transport protocol behaves honestly', testSerialTransportProtocol],
    ['median filter rejects noise, never fakes data', testMedianFilterRejectsNoise],
    ['distance interlock hysteresis stays conservative', testDistanceInterlockHysteresis]
  ];

  for (const [name, test] of tests) {
    await test();
    console.log(`ok - ${name}`);
  }
  console.log(`Real hardware safety invariant tests passed (${tests.length} tests).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
