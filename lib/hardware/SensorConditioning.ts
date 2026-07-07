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

export interface DistanceInterlockOptions {
  /** Lock actuation when the filtered distance drops below this. */
  lockBelowCm: number;
  /** Unlock only when the filtered distance rises above this. Must be > lockBelowCm. */
  releaseAboveCm: number;
}

export interface DistanceInterlockState {
  locked: boolean;
  /**
   * Threshold to feed into SensorSafetyPolicy.minSafeDistanceCm.
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
