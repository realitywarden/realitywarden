import type { HardwareGateOutcome, HardwareExecutionGate } from './HardwareExecutionGate';
import type { SensorEvidenceSnapshot } from './SensorPollingService';
import type { HardwareCommand, InterlockOverride } from './types';

export interface SensorEvidencePoller {
  pollOnce(): Promise<SensorEvidenceSnapshot>;
}

export type HardwareActionSequenceStatus =
  | 'completed'
  | 'interrupted'
  | 'failed'
  | 'cancelled'
  | 'rejected';

export interface HardwareActionSequenceStepResult {
  command: HardwareCommand;
  sensorGeneration: number;
  outcome: HardwareGateOutcome;
}

export interface HardwareActionSequenceResult {
  status: HardwareActionSequenceStatus;
  reason: string;
  executionMode: 'real_hardware';
  completedSteps: number;
  steps: HardwareActionSequenceStepResult[];
}

export interface HardwareActionSequenceOptions {
  signal?: AbortSignal;
  interlockOverrides?: InterlockOverride[];
}

/**
 * Runs already-expanded primitive hardware commands sequentially.
 *
 * Every primitive obtains a NEW polling generation immediately before the
 * gate decision. A blocked/failed/cancelled step terminates the sequence, so
 * no later primitive can emit a frame. This runner never imports or receives
 * an actuation ticket; HardwareExecutionGate remains the sole actuation path.
 */
export class HardwareActionSequenceRunner {
  constructor(
    private readonly gate: HardwareExecutionGate,
    private readonly sensors: SensorEvidencePoller
  ) {}

  async run(
    commands: readonly HardwareCommand[],
    options: HardwareActionSequenceOptions = {}
  ): Promise<HardwareActionSequenceResult> {
    if (commands.length < 1 || commands.length > 16) {
      return this.result('rejected', `invalid_sequence_length:${commands.length}`, []);
    }
    // Snapshot untrusted caller data up front so it cannot change while a
    // sensor poll is in flight (TOCTOU). SafetyMonitor still validates every
    // primitive and rejects invalid values; nothing is clamped here.
    const sequence = commands.map((command) => ({
      ...command,
      args: { ...command.args }
    }));
    const ids = new Set<string>();
    for (const command of sequence) {
      if (!command.id || ids.has(command.id)) {
        return this.result('rejected', `invalid_or_duplicate_command_id:${command.id}`, []);
      }
      ids.add(command.id);
    }

    const steps: HardwareActionSequenceStepResult[] = [];
    for (const command of sequence) {
      if (options.signal?.aborted) {
        return this.result('cancelled', 'sequence_cancelled_before_step', steps);
      }

      const evidence = await this.sensors.pollOnce();
      if (options.signal?.aborted) {
        return this.result('cancelled', 'sequence_cancelled_after_sensor_poll', steps);
      }

      const outcome = await this.gate.run({
        command,
        sensorReadings: evidence.readings,
        frozenSensorIds: evidence.frozenSensorIds,
        interlockOverrides: options.interlockOverrides,
        nowMs: evidence.observedAtMs
      });
      steps.push({
        command: { ...command, args: { ...command.args } },
        sensorGeneration: evidence.generation,
        outcome
      });

      if (outcome.status === 'blocked') {
        return this.result('interrupted', `interlock:${outcome.reason}`, steps);
      }
      if (outcome.status === 'failed') {
        return this.result('failed', `hardware_step_failed:${outcome.reason}`, steps);
      }
    }
    return this.result('completed', 'all_primitive_steps_executed', steps);
  }

  private result(
    status: HardwareActionSequenceStatus,
    reason: string,
    steps: HardwareActionSequenceStepResult[]
  ): HardwareActionSequenceResult {
    return {
      status,
      reason,
      executionMode: 'real_hardware',
      completedSteps: steps.filter((step) => step.outcome.status === 'executed').length,
      steps
    };
  }
}
