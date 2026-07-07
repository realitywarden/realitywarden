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

export interface HardwareCapabilityLimit {
  capabilityId: HardwareCapabilityId;
  /** Inclusive numeric bounds for the primary argument, if any. */
  min?: number;
  max?: number;
  unit?: string;
  /** True if this capability physically actuates something. */
  actuation: boolean;
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
  /** Epoch milliseconds when the reading was taken. */
  timestampMs: number;
}

export interface SensorSafetyPolicy {
  sensorId: string;
  /** Reading older than this is stale => default-block. */
  maxAgeMs: number;
  /** Physically plausible range; outside => invalid => default-block. */
  minPlausibleValue: number;
  maxPlausibleValue: number;
  /**
   * Actuation interlock: if the sensor value is below this threshold,
   * actuation commands are blocked (e.g. obstacle too close).
   */
  minSafeDistanceCm?: number;
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
