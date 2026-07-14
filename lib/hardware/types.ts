/**
 * Real-hardware execution types.
 *
 * This module is intentionally separate from the simulation-only runtime.
 * Everything here is about REAL physical devices. Core invariants:
 *
 * 1. A blocked command must never reach the hardware adapter's execute().
 * 2. When the transport is offline, results must report signalSent: false —
 *    never fake success.
 * 3. Missing / stale / physically-implausible sensor data => default-block.
 * 4. Every allow/block decision is written to the audit log with an explicit
 *    hardwareSignalSent boolean.
 * 5. No silent fallback: unsupported capabilities fail loudly.
 * 6. Real execution is always labeled executionMode: 'real_hardware' so it can
 *    never be confused with simulation output.
 */

export type HardwareCapabilityId = 'move_to_angle' | 'read_distance';

/**
 * Authoritative sensor-interlock requirement, DECLARED BY THE DEVICE CAPABILITY
 * TABLE — never assembled by the caller (audit finding 2.1). If an actuation
 * capability declares an interlock here, the SafetyMonitor enforces it from
 * this declaration; a caller cannot omit it to skip the interlock.
 */
export interface SensorInterlockRequirement {
  sensorId: string;
  /** Capability and unit expected from this safety-linked sensor. */
  capabilityId: HardwareCapabilityId;
  unit: string;
  /** Reading older than this is stale => default-block. */
  maxAgeMs: number;
  /** Physically plausible range; outside => invalid => default-block. */
  minPlausibleValue: number;
  maxPlausibleValue: number;
  /**
   * Static baseline minimum safe distance. A per-call InterlockOverride may
   * only TIGHTEN this (raise it); a looser override is rejected, never applied.
   */
  minSafeDistanceCm?: number;
}

/**
 * Per-call dynamic tightening of an interlock threshold (e.g. hysteresis).
 * Can ONLY make the threshold more conservative than the capability baseline;
 * a value below the baseline is rejected as invalid_interlock_override
 * (invariant 3: no silent correction).
 */
export interface InterlockOverride {
  sensorId: string;
  minSafeDistanceCm: number;
}

export interface HardwareArgumentLimit {
  /** Exact HardwareCommand.args key governed by this bound. */
  argument: string;
  /** Inclusive finite bounds. Invalid or inverted declarations fail closed. */
  min: number;
  max: number;
  unit?: string;
}

export interface HardwareCapabilityLimit {
  capabilityId: HardwareCapabilityId;
  /**
   * Authoritative numeric argument bounds. Required even when empty so every
   * capability makes an explicit declaration. For actuation, any numeric arg
   * without a matching entry is rejected by SafetyMonitor (audits 2.3/5.2).
   */
  argumentLimits: HardwareArgumentLimit[];
  unit?: string;
  /** True if this capability physically actuates something. */
  actuation: boolean;
  /**
   * Sensor interlocks this capability depends on. REQUIRED (not optional) so a
   * device author must make a deliberate, reviewable decision: a non-actuation
   * capability declares an empty array; an actuation capability with a genuine
   * sensor dependency declares it here. An empty array on an actuation
   * capability is allowed but must be justified in a comment at the site.
   */
  requiredSensorInterlocks: SensorInterlockRequirement[];
}

export interface HardwareCommand {
  id: string;
  deviceId: string;
  capabilityId: HardwareCapabilityId;
  /** Primary arguments, e.g. { angle: 45 } for move_to_angle. */
  args: Record<string, number | string | boolean>;
}

export interface HardwareExecuteResult {
  ok: boolean;
  /** True ONLY if a signal actually left the host toward the device. */
  signalSent: boolean;
  detail: string;
  data?: Record<string, unknown>;
}

export interface SensorReading {
  sensorId: string;
  capabilityId: HardwareCapabilityId;
  value: number;
  unit: string;
  /** Host epoch milliseconds when the reading was received. */
  timestampMs: number;
  /**
   * Device-side monotonic timestamp (ESP32 millis()) at measurement time
   * (audit 2.2). REQUIRED for actuation-gating sensors: if absent, the
   * SafetyMonitor blocks actuation (device_timestamp_unavailable) rather than
   * silently falling back to the host arrival time (invariant 3). Absent only
   * for legacy firmware that does not report it.
   */
  deviceTimestampMs?: number;
}

/** Wire frame sent to the ESP32 (newline-delimited JSON). */
export interface TransportFrame {
  id: string;
  cmd: string;
  args?: Record<string, number | string | boolean>;
}

/** Wire response received from the ESP32. */
export interface TransportResponse {
  id: string;
  ok: boolean;
  detail?: string;
  data?: Record<string, unknown>;
}
