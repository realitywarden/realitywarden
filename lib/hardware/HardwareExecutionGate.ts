import { RuntimeAuditLog } from '../runtime/RuntimeAuditLog';
import { SafetyMonitor } from '../runtime/SafetyMonitor';
import type { Esp32DeviceAdapter } from './Esp32DeviceAdapter';
import type {
  HardwareCapabilityLimit,
  HardwareCommand,
  HardwareExecuteResult,
  InterlockOverride,
  SensorReading
} from './types';

export type HardwareGateStatus = 'executed' | 'failed' | 'blocked';

export interface HardwareGateOutcome {
  status: HardwareGateStatus;
  reason: string;
  /** Always 'real_hardware' — so logs/UI can never confuse this with simulation. */
  executionMode: 'real_hardware';
  result: HardwareExecuteResult;
}

export interface HardwareGateRequest {
  command: HardwareCommand;
  capabilityLimits: HardwareCapabilityLimit[];
  sensorReadings: SensorReading[];
  /**
   * Optional per-call tightening of interlock thresholds (e.g. hysteresis).
   * Interlock REQUIREMENTS are authoritative in the capability declaration,
   * not here (audit 2.1); an override may only tighten, never introduce or
   * loosen an interlock.
   */
  interlockOverrides?: InterlockOverride[];
  nowMs?: number;
}

/**
 * The ONLY sanctioned path from a decision to a real device.
 *
 * Core invariant enforced here: when the SafetyMonitor blocks a command,
 * adapter.execute() is NOT called — there is no code path from a blocked
 * decision to the transport. Every decision (allow or block) is written to
 * the audit log with an explicit hardwareSignalSent boolean.
 */
export class HardwareExecutionGate {
  constructor(
    private readonly adapter: Esp32DeviceAdapter,
    private readonly safetyMonitor: SafetyMonitor = new SafetyMonitor(),
    private readonly audit: RuntimeAuditLog = new RuntimeAuditLog()
  ) {}

  getAuditLog(): RuntimeAuditLog {
    return this.audit;
  }

  async run(request: HardwareGateRequest): Promise<HardwareGateOutcome> {
    const { command } = request;
    const decision = this.safetyMonitor.evaluateHardwareCommand({
      command,
      capabilityLimits: request.capabilityLimits,
      sensorReadings: request.sensorReadings,
      interlockOverrides: request.interlockOverrides,
      nowMs: request.nowMs
    });

    if (!decision.ok) {
      // Blocked: adapter.execute() is never reached. hardwareSignalSent=false.
      this.audit.decision(
        'hardware',
        'error',
        'hardware_command_blocked',
        `Hardware command blocked: ${decision.reason}`,
        false,
        {
          commandId: command.id,
          deviceId: command.deviceId,
          capabilityId: command.capabilityId,
          args: command.args,
          executionMode: 'real_hardware',
          reason: decision.reason
        }
      );
      return {
        status: 'blocked',
        reason: decision.reason,
        executionMode: 'real_hardware',
        result: { ok: false, signalSent: false, detail: `blocked: ${decision.reason}` }
      };
    }

    const result = await this.adapter.execute(command);
    this.audit.decision(
      'hardware',
      result.ok ? 'info' : 'error',
      result.ok ? 'hardware_command_executed' : 'hardware_command_failed',
      result.ok
        ? `Hardware command executed: ${command.capabilityId}`
        : `Hardware command failed: ${result.detail}`,
      result.signalSent,
      {
        commandId: command.id,
        deviceId: command.deviceId,
        capabilityId: command.capabilityId,
        args: command.args,
        executionMode: 'real_hardware',
        detail: result.detail
      }
    );

    return {
      status: result.ok ? 'executed' : 'failed',
      reason: result.ok ? decision.reason : result.detail,
      executionMode: 'real_hardware',
      result
    };
  }
}
