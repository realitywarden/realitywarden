import { TransportOfflineError } from './RealDeviceTransport';
import type { RealDeviceTransport } from './RealDeviceTransport';
import type {
  HardwareCapabilityId,
  HardwareCapabilityLimit,
  HardwareCommand,
  HardwareExecuteResult,
  SensorReading
} from './types';

export const ESP32_SERVO_RIG_CAPABILITIES: HardwareCapabilityLimit[] = [
  {
    capabilityId: 'move_to_angle',
    min: 0,
    max: 180,
    unit: 'deg',
    actuation: true,
    // Authoritative interlock (audit 2.1): the servo may not actuate unless a
    // fresh, plausible HC-SR04 distance reading clears the safe threshold. This
    // requirement lives here, not in the caller — a caller cannot omit it to
    // skip the interlock.
    requiredSensorInterlocks: [
      {
        sensorId: 'hc-sr04',
        maxAgeMs: 1500,
        minPlausibleValue: 2,   // HC-SR04 physical range: 2cm..400cm
        maxPlausibleValue: 400,
        minSafeDistanceCm: 10
      }
    ]
  },
  {
    capabilityId: 'read_distance',
    unit: 'cm',
    actuation: false,
    // Read-only capability: no actuation, therefore no interlock required.
    requiredSensorInterlocks: []
  }
];

/**
 * Adapter for the ESP32 DevKit rig (SG90 servo + HC-SR04 ultrasonic sensor).
 *
 * IMPORTANT: this adapter performs NO safety policy decisions. Safety lives in
 * the SafetyMonitor and the execution gate; by the time execute() is called
 * the command must already have been allowed. The adapter still enforces its
 * own physical limits as defense-in-depth — a command outside physical limits
 * is refused WITHOUT sending a signal, never clamped or "fixed" silently.
 */
export class Esp32DeviceAdapter {
  constructor(
    private readonly transport: RealDeviceTransport,
    private readonly capabilities: HardwareCapabilityLimit[] = ESP32_SERVO_RIG_CAPABILITIES
  ) {}

  supportedCapabilities(): HardwareCapabilityId[] {
    return this.capabilities.map((capability) => capability.capabilityId);
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  async execute(command: HardwareCommand): Promise<HardwareExecuteResult> {
    const capability = this.capabilities.find(
      (entry) => entry.capabilityId === command.capabilityId
    );
    if (!capability) {
      // No silent fallback: unknown capability is an explicit failure.
      return {
        ok: false,
        signalSent: false,
        detail: `unsupported capability: ${command.capabilityId}`
      };
    }

    if (!this.transport.isConnected()) {
      return { ok: false, signalSent: false, detail: 'hardware offline' };
    }

    // Defense-in-depth physical limit check (primary check is in SafetyMonitor).
    if (command.capabilityId === 'move_to_angle') {
      const angle = command.args.angle;
      if (typeof angle !== 'number' || Number.isNaN(angle)) {
        return { ok: false, signalSent: false, detail: 'move_to_angle requires numeric args.angle' };
      }
      if ((capability.min !== undefined && angle < capability.min)
        || (capability.max !== undefined && angle > capability.max)) {
        return {
          ok: false,
          signalSent: false,
          detail: `angle ${angle} outside physical limits [${capability.min}, ${capability.max}]`
        };
      }
    }

    try {
      const response = await this.transport.send({
        id: command.id,
        cmd: command.capabilityId,
        args: command.args
      });
      return {
        ok: response.ok,
        // The frame left the host and the device answered => signal was sent,
        // even if the device reports a failure.
        signalSent: true,
        detail: response.detail ?? (response.ok ? 'device acknowledged' : 'device reported failure'),
        data: response.data
      };
    } catch (error) {
      if (error instanceof TransportOfflineError) {
        return { ok: false, signalSent: false, detail: 'hardware offline' };
      }
      // Timeout / write errors after connect: the signal may have left the
      // host, but delivery was never confirmed. Report honestly as not ok;
      // signalSent stays false only when we know nothing left the host.
      return {
        ok: false,
        signalSent: true,
        detail: `device communication failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Read the HC-SR04 distance sensor. Returns null (with no fake value) when
   * the transport is offline or the device fails to answer.
   */
  async readDistance(sensorId = 'hc-sr04'): Promise<SensorReading | null> {
    if (!this.transport.isConnected()) {
      return null;
    }
    try {
      const response = await this.transport.send({
        id: `read-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cmd: 'read_distance'
      });
      const value = response.data?.distanceCm;
      if (!response.ok || typeof value !== 'number' || Number.isNaN(value)) {
        return null;
      }
      // Device-side monotonic clock at measurement (audit 2.2). Present only if
      // the firmware reports it; absence makes the SafetyMonitor block actuation
      // (device_timestamp_unavailable) — never a silent fallback to host time.
      const deviceMs = response.data?.deviceMs;
      return {
        sensorId,
        capabilityId: 'read_distance',
        value,
        unit: 'cm',
        timestampMs: Date.now(),
        deviceTimestampMs: typeof deviceMs === 'number' && !Number.isNaN(deviceMs) ? deviceMs : undefined
      };
    } catch {
      return null;
    }
  }
}
