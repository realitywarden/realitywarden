import type { AdapterDryRunResult, AdapterPlan, AdapterPlanValidationResult } from '@/lib/adapter-sdk';
import type {
  HardwareCapabilityLimit,
  HardwareCommand,
  SensorReading,
  SensorSafetyPolicy
} from '@/lib/hardware/types';
import type { DeviceManifest } from '@/lib/open-reality-runtime/types';

export interface SafetyMonitorDecision {
  ok: boolean;
  reason: string;
}

export interface HardwareSafetyContext {
  command: HardwareCommand;
  capabilityLimits: HardwareCapabilityLimit[];
  /** Latest known readings for safety-linked sensors. */
  sensorReadings: SensorReading[];
  /** Policies for every sensor that gates this device's actuation. */
  sensorPolicies: SensorSafetyPolicy[];
  /** Injectable clock for tests. Defaults to Date.now(). */
  nowMs?: number;
}

export class SafetyMonitor {
  evaluateSimulationBoundary(
    manifest: DeviceManifest,
    plan: AdapterPlan,
    validation: AdapterPlanValidationResult,
    dryRun: AdapterDryRunResult
  ): SafetyMonitorDecision {
    if (manifest.adapter.realAdapterEnabled) {
      return {
        ok: false,
        reason: 'real_adapter_enabled'
      };
    }

    if (!validation.ok) {
      return {
        ok: false,
        reason: `adapter_plan_invalid:${validation.errors.join(',')}`
      };
    }

    if (plan.dryRunOnly !== true) {
      return {
        ok: false,
        reason: 'adapter_plan_must_remain_dry_run_only'
      };
    }

    if (plan.mode === 'real_disabled') {
      return {
        ok: false,
        reason: 'adapter_plan_mode_real_disabled'
      };
    }

    if (!dryRun.ok || dryRun.dryRunOnly !== true) {
      return {
        ok: false,
        reason: 'adapter_dry_run_failed'
      };
    }

    return {
      ok: true,
      reason: 'simulation_only_execution_authorized'
    };
  }

  /**
   * Gate for REAL hardware commands.
   *
   * Default-block philosophy: if anything about the command or its
   * safety-linked sensors is unknown, stale, or implausible, the command is
   * blocked. Sensors fail closed, never open.
   */
  evaluateHardwareCommand(context: HardwareSafetyContext): SafetyMonitorDecision {
    const { command, capabilityLimits, sensorReadings, sensorPolicies } = context;
    const nowMs = context.nowMs ?? Date.now();

    const capability = capabilityLimits.find(
      (entry) => entry.capabilityId === command.capabilityId
    );
    if (!capability) {
      return { ok: false, reason: `unsupported_capability:${command.capabilityId}` };
    }

    if (command.capabilityId === 'move_to_angle') {
      const angle = command.args.angle;
      if (typeof angle !== 'number' || Number.isNaN(angle)) {
        return { ok: false, reason: 'invalid_argument:angle_not_numeric' };
      }
      if ((capability.min !== undefined && angle < capability.min)
        || (capability.max !== undefined && angle > capability.max)) {
        return {
          ok: false,
          reason: `angle_out_of_range:${angle} not in [${capability.min ?? '-inf'}, ${capability.max ?? 'inf'}]`
        };
      }
    }

    // Sensor interlocks only gate actuation; pure reads stay allowed so the
    // operator can still observe the world while actuation is locked out.
    if (capability.actuation) {
      for (const policy of sensorPolicies) {
        const reading = sensorReadings.find((entry) => entry.sensorId === policy.sensorId);
        if (!reading) {
          return { ok: false, reason: `sensor_missing:${policy.sensorId}` };
        }
        const ageMs = nowMs - reading.timestampMs;
        if (ageMs > policy.maxAgeMs) {
          return {
            ok: false,
            reason: `sensor_stale:${policy.sensorId}:age_ms=${ageMs}>max_age_ms=${policy.maxAgeMs}`
          };
        }
        if (
          Number.isNaN(reading.value)
          || reading.value < policy.minPlausibleValue
          || reading.value > policy.maxPlausibleValue
        ) {
          return {
            ok: false,
            reason: `sensor_invalid:${policy.sensorId}:value=${reading.value} not in [${policy.minPlausibleValue}, ${policy.maxPlausibleValue}]`
          };
        }
        if (policy.minSafeDistanceCm !== undefined && reading.value < policy.minSafeDistanceCm) {
          return {
            ok: false,
            reason: `min_safe_distance_violation:${policy.sensorId}:distance_cm=${reading.value}<min=${policy.minSafeDistanceCm}`
          };
        }
      }
    }

    return { ok: true, reason: 'hardware_command_allowed' };
  }
}
