import type { SensorReading } from './types';

/**
 * Sensor conditioning for real hardware: median filtering + hysteresis
 * interlock for the distance sensor.
 *
 * SAFETY DESIGN: this layer sits BEFORE the SafetyMonitor and can only make
 * the system MORE conservative, never less:
 * - The median filter rejects single-sample noise spikes; it never invents
 *   readings (no samples => null, which default-blocks downstream).
 * - The hysteresis interlock, once locked, raises the effective safe-distance
 *   threshold to `releaseAboveCm` (> `lockBelowCm`), so actuation stays
 *   blocked until the obstacle is clearly gone — no flapping around the
 *   threshold (e.g. 9.9cm / 10.1cm jitter).
 * The SafetyMonitor itself is untouched; callers feed it the filtered reading
 * and the interlock's effective threshold.
 */

export class MedianFilter {
  private values: number[] = [];

  constructor(private readonly windowSize = 5) {
    if (!Number.isInteger(windowSize) || windowSize < 1) {
      throw new Error(`MedianFilter windowSize must be a positive integer, got ${windowSize}`);
    }
  }

  /** Add a sample and return the current median. NaN samples are rejected. */
  push(value: number): number | null {
    if (!Number.isNaN(value)) {
      this.values.push(value);
      if (this.values.length > this.windowSize) {
        this.values.shift();
      }
    }
    return this.median();
  }

  /** Current median, or null when no samples exist (fail closed downstream). */
  median(): number | null {
    if (this.values.length === 0) return null;
    const sorted = [...this.values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  reset() {
    this.values = [];
  }
}

/**
 * Build one conservative reading from a sampling window. The median value is
 * paired with the OLDEST host/device timestamps in the window: refreshing the
 * timestamp after later failed reads would make stale sensor data look fresh.
 */
export function buildConservativeMedianReading(
  readings: readonly SensorReading[]
): SensorReading | null {
  if (readings.length === 0) return null;
  const first = readings[0];
  if (readings.some((reading) =>
    reading.sensorId !== first.sensorId
    || reading.capabilityId !== first.capabilityId
    || reading.unit !== first.unit
    || !Number.isFinite(reading.value)
    || !Number.isFinite(reading.timestampMs))) {
    return null;
  }

  const sortedValues = readings.map((reading) => reading.value).sort((a, b) => a - b);
  const mid = Math.floor(sortedValues.length / 2);
  const value = sortedValues.length % 2 === 1
    ? sortedValues[mid]
    : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
  const deviceTimestamps = readings.map((reading) => reading.deviceTimestampMs);
  const allDeviceTimestampsValid = deviceTimestamps.every(
    (timestamp): timestamp is number => typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0
  );

  return {
    ...first,
    value,
    timestampMs: Math.min(...readings.map((reading) => reading.timestampMs)),
    deviceTimestampMs: allDeviceTimestampsValid ? Math.min(...deviceTimestamps) : undefined
  };
}

export interface DistanceInterlockOptions {
  /** Lock actuation when the filtered distance drops below this. */
  lockBelowCm: number;
  /** Unlock only when the filtered distance rises above this. Must be > lockBelowCm. */
  releaseAboveCm: number;
}

export interface DistanceInterlockState {
  locked: boolean;
  /**
   * Threshold to feed into an InterlockOverride.minSafeDistanceCm (tighten-only).
   * While locked this equals releaseAboveCm, so the SafetyMonitor keeps
   * blocking until the distance is clearly safe again. Never below lockBelowCm.
   */
  effectiveMinSafeDistanceCm: number;
}

export class DistanceInterlock {
  private locked = false;

  constructor(private readonly options: DistanceInterlockOptions) {
    if (!(options.releaseAboveCm > options.lockBelowCm)) {
      throw new Error(
        `DistanceInterlock requires releaseAboveCm (${options.releaseAboveCm}) > lockBelowCm (${options.lockBelowCm})`
      );
    }
  }

  /**
   * Update with the latest filtered distance (null = no data => lock).
   * Inside the hysteresis band [lockBelowCm, releaseAboveCm] the previous
   * state is kept, which is what prevents threshold flapping.
   */
  update(filteredDistanceCm: number | null): DistanceInterlockState {
    if (filteredDistanceCm === null || Number.isNaN(filteredDistanceCm)) {
      this.locked = true; // no data fails closed, consistent with default-block
    } else if (filteredDistanceCm < this.options.lockBelowCm) {
      this.locked = true;
    } else if (filteredDistanceCm > this.options.releaseAboveCm) {
      this.locked = false;
    }
    return this.state();
  }

  state(): DistanceInterlockState {
    return {
      locked: this.locked,
      effectiveMinSafeDistanceCm: this.locked
        ? this.options.releaseAboveCm
        : this.options.lockBelowCm
    };
  }
}


/**
 * Device-clock baseline (audit 2.2). Establishes the (host, device) time pair
 * at handshake so freshness can be judged by the DEVICE clock, and tracks the
 * last device timestamp to detect a clock that has stopped advancing.
 */
export class DeviceClockBaseline {
  private deviceMs0: number | null = null;
  private lastDeviceMs: number | null = null;

  /** Establish the baseline at handshake. */
  establish(deviceMs: number): void {
    this.deviceMs0 = deviceMs;
    this.lastDeviceMs = deviceMs;
  }

  established(): boolean {
    return this.deviceMs0 !== null;
  }

  /** Device-side elapsed since baseline; null if not established. */
  deviceElapsedMs(deviceMs: number): number | null {
    return this.deviceMs0 === null ? null : deviceMs - this.deviceMs0;
  }

  /** True if this deviceMs strictly advanced past the last one seen. */
  hasAdvanced(deviceMs: number): boolean {
    return this.lastDeviceMs === null ? true : deviceMs > this.lastDeviceMs;
  }

  /** Record the latest device timestamp (monotonic; never moves backward). */
  update(deviceMs: number): void {
    if (this.lastDeviceMs === null || deviceMs > this.lastDeviceMs) {
      this.lastDeviceMs = deviceMs;
    }
  }

  reset(): void {
    this.deviceMs0 = null;
    this.lastDeviceMs = null;
  }
}

export interface StuckValueDetectorOptions {
  /**
   * Consecutive identical samples (with a non-advancing device clock) that
   * latch the frozen state. Default 5 (audit 2.2, matches the median window).
   */
  sampleWindow?: number;
}

/**
 * Frozen-sensor detector (audit 2.2, auxiliary line). A run of identical
 * distance values is frozen ONLY if the device clock also fails to advance
 * across the window: a real static object keeps a live, advancing device clock
 * and is never flagged. Frozen LATCHES — once true it stays true until reset()
 * (decision 3: no automatic recovery).
 */
export class StuckValueDetector {
  private readonly window: number;
  private samples: Array<{ value: number; deviceMs: number }> = [];
  private frozen = false;

  constructor(options: StuckValueDetectorOptions = {}) {
    this.window = options.sampleWindow ?? 5;
    if (!Number.isInteger(this.window) || this.window < 1) {
      throw new Error(`StuckValueDetector sampleWindow must be a positive integer, got ${this.window}`);
    }
  }

  /** Feed one raw sample; returns whether the sensor is (now) frozen. */
  push(value: number, deviceMs: number): boolean {
    this.samples.push({ value, deviceMs });
    if (this.samples.length > this.window) {
      this.samples.shift();
    }
    if (!this.frozen && this.samples.length >= this.window) {
      const first = this.samples[0];
      const allSameValue = this.samples.every((sample) => sample.value === first.value);
      const clockStuck = this.samples.every((sample) => sample.deviceMs === first.deviceMs);
      if (allSameValue && clockStuck) {
        this.frozen = true;
      }
    }
    return this.frozen;
  }

  isFrozen(): boolean {
    return this.frozen;
  }

  /** Explicit recovery only (decision 3): frozen never self-clears. */
  reset(): void {
    this.frozen = false;
    this.samples = [];
  }
}
