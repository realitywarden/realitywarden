import { StuckValueDetector, buildConservativeMedianReading } from './SensorConditioning';
import type { SensorReading } from './types';

export interface SensorReadResult {
  reading: SensorReading | null;
  error?: string;
}

export interface DistanceSensorReader {
  readDistanceDetailed(sensorId?: string): Promise<SensorReadResult>;
}

export type SensorPollingState =
  | 'idle'
  | 'healthy'
  | 'degraded'
  | 'frozen'
  | 'stopped';

export interface SensorEvidenceSnapshot {
  /** Monotonically increasing host-side evidence generation. */
  generation: number;
  state: SensorPollingState;
  observedAtMs: number;
  readings: SensorReading[];
  frozenSensorIds: ReadonlySet<string>;
  lastError?: string;
}

export interface DistanceSensorPollingOptions {
  sensorId?: string;
  intervalMs?: number;
  sampleWindow?: number;
  now?: () => number;
}

export type SensorEvidenceSubscriber = (snapshot: SensorEvidenceSnapshot) => void;

/**
 * Continuously collects safety evidence for the ESP32 distance interlock.
 *
 * A failed poll immediately publishes an EMPTY evidence set. The service never
 * keeps the last good value alive across a failed read. Device-clock regression
 * and frozen values latch until resetSensorLatch() is called explicitly.
 * Subscribers receive defensive snapshots and have no authority to mutate the
 * evidence consumed by HardwareExecutionGate.
 */
export class DistanceSensorPollingService {
  private readonly sensorId: string;
  private readonly intervalMs: number;
  private readonly sampleWindow: number;
  private readonly now: () => number;
  private readonly frozenDetector: StuckValueDetector;
  private readonly subscribers = new Set<SensorEvidenceSubscriber>();
  private samples: SensorReading[] = [];
  private generation = 0;
  private running = false;
  private stopped = false;
  private lifecycleEpoch = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<SensorEvidenceSnapshot> | null = null;
  private lastDeviceTimestampMs: number | null = null;
  private clockFaultLatched = false;
  private snapshotValue: SensorEvidenceSnapshot;

  constructor(
    private readonly reader: DistanceSensorReader,
    options: DistanceSensorPollingOptions = {}
  ) {
    this.sensorId = options.sensorId ?? 'hc-sr04';
    this.intervalMs = options.intervalMs ?? 250;
    this.sampleWindow = options.sampleWindow ?? 5;
    this.now = options.now ?? Date.now;
    if (!Number.isFinite(this.intervalMs) || this.intervalMs < 20) {
      throw new Error(`sensor polling intervalMs must be finite and >= 20, got ${this.intervalMs}`);
    }
    if (!Number.isInteger(this.sampleWindow) || this.sampleWindow < 1) {
      throw new Error(`sensor polling sampleWindow must be a positive integer, got ${this.sampleWindow}`);
    }
    this.frozenDetector = new StuckValueDetector({ sampleWindow: this.sampleWindow });
    this.snapshotValue = this.makeSnapshot('idle', [], undefined);
  }

  start(): void {
    if (this.running) return;
    this.stopped = false;
    this.running = true;
    void this.tick();
  }

  stop(): void {
    this.running = false;
    this.stopped = true;
    this.lifecycleEpoch += 1;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.samples = [];
    this.publish('stopped', [], 'sensor_polling_stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  subscribe(subscriber: SensorEvidenceSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.snapshot());
    return () => this.subscribers.delete(subscriber);
  }

  snapshot(): SensorEvidenceSnapshot {
    return this.cloneSnapshot(this.snapshotValue);
  }

  /**
   * Obtain a new evidence generation. Concurrent callers share the same read,
   * preventing overlapping serial requests from manufacturing ordering races.
   */
  pollOnce(): Promise<SensorEvidenceSnapshot> {
    if (this.stopped) return Promise.resolve(this.snapshot());
    if (this.inFlight) return this.inFlight.then((snapshot) => this.cloneSnapshot(snapshot));
    this.inFlight = this.collect().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight.then((snapshot) => this.cloneSnapshot(snapshot));
  }

  /** Frozen/clock latches never self-clear; recovery must be explicit. */
  resetSensorLatch(): void {
    this.lifecycleEpoch += 1;
    this.frozenDetector.reset();
    this.clockFaultLatched = false;
    this.lastDeviceTimestampMs = null;
    this.samples = [];
    this.publish('degraded', [], 'sensor_latch_reset_requires_fresh_evidence');
  }

  private async tick(): Promise<void> {
    await this.pollOnce();
    if (!this.running) return;
    this.timer = setTimeout(() => void this.tick(), this.intervalMs);
  }

  private async collect(): Promise<SensorEvidenceSnapshot> {
    const epoch = this.lifecycleEpoch;
    const result = await this.reader.readDistanceDetailed(this.sensorId).catch((error: unknown) => ({
      reading: null,
      error: `sensor_poll_failed: ${error instanceof Error ? error.message : String(error)}`
    }));
    // stop()/resetSensorLatch() invalidates an in-flight response. A late
    // serial reply must never overwrite the explicit stopped/reset state.
    if (this.stopped || epoch !== this.lifecycleEpoch) return this.snapshotValue;
    const reading = result.reading;
    if (!reading) {
      this.samples = [];
      return this.publish('degraded', [], result.error ?? 'sensor_read_missing');
    }

    if (reading.sensorId !== this.sensorId) {
      this.samples = [];
      return this.publish('degraded', [], `sensor_identity_mismatch:${reading.sensorId}`);
    }

    const deviceMs = reading.deviceTimestampMs;
    if (typeof deviceMs === 'number' && Number.isFinite(deviceMs) && deviceMs >= 0) {
      if (this.lastDeviceTimestampMs !== null && deviceMs < this.lastDeviceTimestampMs) {
        this.clockFaultLatched = true;
      } else {
        this.lastDeviceTimestampMs = deviceMs;
      }
      this.frozenDetector.push(reading.value, deviceMs);
    }

    if (this.clockFaultLatched || this.frozenDetector.isFrozen()) {
      this.samples = [];
      const reason = this.clockFaultLatched ? 'device_clock_regressed_latched' : 'sensor_frozen_latched';
      // Preserve the raw typed reading only so SafetyMonitor can report the
      // stronger sensor_frozen reason. frozenSensorIds makes it unusable for
      // authorization and cannot be overridden by the caller.
      return this.publish('frozen', [{ ...reading }], reason);
    }

    this.samples.push({ ...reading });
    if (this.samples.length > this.sampleWindow) this.samples.shift();
    const conditioned = buildConservativeMedianReading(this.samples);
    if (!conditioned) {
      this.samples = [];
      return this.publish('degraded', [], 'sensor_conditioning_rejected');
    }

    // For a distance interlock, a newly closer sample is safety-significant and
    // must not be hidden until the median window catches up. Taking the lower
    // of latest and median can only tighten the minimum-distance interlock.
    const conservative = {
      ...conditioned,
      value: Math.min(conditioned.value, reading.value)
    };
    return this.publish('healthy', [conservative], undefined);
  }

  private publish(
    state: SensorPollingState,
    readings: SensorReading[],
    lastError: string | undefined
  ): SensorEvidenceSnapshot {
    this.generation += 1;
    this.snapshotValue = this.makeSnapshot(state, readings, lastError);
    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(this.snapshot());
      } catch {
        // A presentation subscriber cannot stop or alter safety evidence.
      }
    });
    return this.snapshotValue;
  }

  private makeSnapshot(
    state: SensorPollingState,
    readings: SensorReading[],
    lastError: string | undefined
  ): SensorEvidenceSnapshot {
    const frozen = state === 'frozen' ? new Set([this.sensorId]) : new Set<string>();
    return {
      generation: this.generation,
      state,
      observedAtMs: this.now(),
      readings: readings.map((reading) => ({ ...reading })),
      frozenSensorIds: frozen,
      lastError
    };
  }

  private cloneSnapshot(snapshot: SensorEvidenceSnapshot): SensorEvidenceSnapshot {
    return {
      ...snapshot,
      readings: snapshot.readings.map((reading) => ({ ...reading })),
      frozenSensorIds: new Set(snapshot.frozenSensorIds)
    };
  }
}
