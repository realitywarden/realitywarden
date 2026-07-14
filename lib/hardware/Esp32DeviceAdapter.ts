import { ACTUATION_TICKET } from './internal/actuation';
import type { ActuationTicket } from './internal/actuation';
import { TransportFrameRejectedError, TransportOfflineError } from './RealDeviceTransport';
import type { RealDeviceTransport } from './RealDeviceTransport';
import type {
  HardwareCapabilityId,
  HardwareCapabilityLimit,
  HardwareCommand,
  HardwareExecuteResult,
  SensorReading
} from './types';

export interface DistanceReadResult {
  reading: SensorReading | null;
  error?: string;
}

export const ESP32_SERVO_RIG_CAPABILITIES: HardwareCapabilityLimit[] = [
  {
    capabilityId: 'move_to_angle',
    argumentLimits: [{ argument: 'angle', min: 0, max: 180, unit: 'deg' }],
    unit: 'deg',
    actuation: true,
    // Authoritative interlock (audit 2.1): the servo may not actuate unless a
    // fresh, plausible ultrasonic distance reading clears the safe threshold.
    // requirement lives here, not in the caller — a caller cannot omit it to
    // skip the interlock.
    requiredSensorInterlocks: [
      {
        sensorId: 'hc-sr04',
        capabilityId: 'read_distance',
        unit: 'cm',
        maxAgeMs: 1500,
        minPlausibleValue: 2,   // HC-SR04 physical range: 2cm..400cm
        maxPlausibleValue: 400,
        minSafeDistanceCm: 10
      }
    ]
  },
  {
    capabilityId: 'read_distance',
    argumentLimits: [],
    unit: 'cm',
    actuation: false,
    // Read-only capability: no actuation, therefore no interlock required.
    requiredSensorInterlocks: []
  }
];

/**
 * Adapter for the ESP32 DevKit rig (SG90 servo + HC-SR04-compatible pulse sensor).
 *
 * IMPORTANT: this adapter performs NO safety policy decisions. Safety lives in
 * the SafetyMonitor and the execution gate; by the time execute() is called
 * the command must already have been allowed. The adapter still enforces its
 * own physical limits as defense-in-depth — a command outside physical limits
 * is refused WITHOUT sending a signal, never clamped or "fixed" silently.
 */
export class Esp32DeviceAdapter {
  private readonly capabilities: HardwareCapabilityLimit[];

  constructor(
    private readonly transport: RealDeviceTransport,
    capabilities: HardwareCapabilityLimit[] = ESP32_SERVO_RIG_CAPABILITIES
  ) {
    // Snapshot device policy at construction. Callers must not be able to
    // mutate the source array later and silently loosen a live safety gate.
    this.capabilities = capabilities.map((capability) => ({
      ...capability,
      argumentLimits: capability.argumentLimits.map((limit) => ({ ...limit })),
      requiredSensorInterlocks: capability.requiredSensorInterlocks.map((requirement) => ({ ...requirement }))
    }));
  }

  getCapabilities(): HardwareCapabilityLimit[] {
    return this.capabilities.map((capability) => ({
      ...capability,
      argumentLimits: capability.argumentLimits.map((limit) => ({ ...limit })),
      requiredSensorInterlocks: capability.requiredSensorInterlocks.map((requirement) => ({ ...requirement }))
    }));
  }

  supportedCapabilities(): HardwareCapabilityId[] {
    return this.capabilities.map((capability) => capability.capabilityId);
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  /** Audit 3.1: attach the transport's protocol-level error (if any) to a
   *  communication failure, so audit entries carry the real cause instead
   *  of an undifferentiated timeout. */
  private withProtocolError(base: string): string {
    const protocolError = this.transport.getLastProtocolError?.();
    return protocolError ? `${base} (last protocol error: ${protocolError})` : base;
  }

  /**
   * Execute a command that has ALREADY been allowed by the SafetyMonitor.
   *
   * Audit 1.1: `ticket` must be the gate-private ACTUATION_TICKET. The type is
   * only satisfiable by importing `internal/actuation`, which is lint-banned
   * outside the gate; at runtime the transport independently re-checks the
   * ticket, so even untyped JS holding an adapter reference cannot actuate.
   */
  async execute(command: HardwareCommand, ticket: ActuationTicket): Promise<HardwareExecuteResult> {
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

    if (capability.actuation && ticket !== ACTUATION_TICKET) {
      // Defense-in-depth twin of the transport-level check: refuse before
      // building a frame. signalSent=false is honest — nothing left the host.
      return {
        ok: false,
        signalSent: false,
        detail: 'invalid_actuation_ticket: actuation requires the HardwareExecutionGate'
      };
    }

    if (!this.transport.isConnected()) {
      return { ok: false, signalSent: false, detail: 'hardware offline' };
    }

    // Defense-in-depth generic physical limit check (primary check is in
    // SafetyMonitor). Never clamp an untrusted value.
    for (const limit of capability.argumentLimits) {
      const value = command.args[limit.argument];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return {
          ok: false,
          signalSent: false,
          detail: `${command.capabilityId} requires finite numeric args.${limit.argument}`
        };
      }
      if (value < limit.min || value > limit.max) {
        return {
          ok: false,
          signalSent: false,
          detail: `${limit.argument} ${value} outside physical limits [${limit.min}, ${limit.max}]`
        };
      }
    }

    try {
      const frame = {
        id: command.id,
        cmd: command.capabilityId,
        args: command.args
      };
      // Actuation frames must travel the ticketed path; read-only frames use
      // plain send() (which itself refuses actuation cmds — audit 1.1).
      const response = capability.actuation
        ? await this.transport.sendActuation(frame, ticket)
        : await this.transport.send(frame);
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
      if (error instanceof TransportFrameRejectedError) {
        return { ok: false, signalSent: false, detail: error.message };
      }
      // Timeout / write errors after connect: the signal may have left the
      // host, but delivery was never confirmed. Report honestly as not ok;
      // signalSent stays false only when we know nothing left the host.
      return {
        ok: false,
        signalSent: true,
        detail: this.withProtocolError(`device communication failed: ${error instanceof Error ? error.message : String(error)}`)
      };
    }
  }

  /**
   * Read the ultrasonic distance sensor. Returns null (with no fake value) when
   * the transport is offline or the device fails to answer.
   */
  async readDistance(sensorId = 'hc-sr04'): Promise<SensorReading | null> {
    return (await this.readDistanceDetailed(sensorId)).reading;
  }

  /**
   * Read the distance sensor while preserving the device/transport failure
   * reason for operator diagnostics. Safety callers can keep using
   * readDistance(), whose fail-closed null behavior is unchanged.
   */
  async readDistanceDetailed(sensorId = 'hc-sr04'): Promise<DistanceReadResult> {
    if (!this.transport.isConnected()) {
      return { reading: null, error: 'hardware offline' };
    }
    try {
      const response = await this.transport.send({
        id: `read-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cmd: 'read_distance'
      });
      const value = response.data?.distanceCm;
      if (!response.ok) {
        return { reading: null, error: response.detail ?? 'device reported read_distance failure' };
      }
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { reading: null, error: 'device response missing numeric data.distanceCm' };
      }
      // Device-side monotonic clock at measurement (audit 2.2). Present only if
      // the firmware reports it; absence makes the SafetyMonitor block actuation
      // (device_timestamp_unavailable) — never a silent fallback to host time.
      const deviceMs = response.data?.deviceMs;
      return {
        reading: {
          sensorId,
          capabilityId: 'read_distance',
          value,
          unit: 'cm',
          timestampMs: Date.now(),
          deviceTimestampMs: typeof deviceMs === 'number' && Number.isFinite(deviceMs) && deviceMs >= 0
            ? deviceMs
            : undefined
        }
      };
    } catch (error) {
      return {
        reading: null,
        error: this.withProtocolError(error instanceof Error ? error.message : String(error))
      };
    }
  }
}
