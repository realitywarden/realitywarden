import type { AdapterDryRunResult, AdapterPlan, AdapterPlanValidationResult } from '@/lib/adapter-sdk';
import type {
  HardwareCapabilityLimit,
  HardwareCommand,
  InterlockOverride,
  SensorReading
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
  /**
   * Optional per-call tightening of interlock thresholds (e.g. hysteresis).
   * The authoritative interlock requirements come from the matched
   * capability's requiredSensorInterlocks — NOT from the caller (audit 2.1).
   * An override may only tighten; a looser one is rejected.
   */
  interlockOverrides?: InterlockOverride[];
  /**
   * Sensors currently latched as FROZEN by the host conditioning layer (audit
   * 2.2): value stuck while the device clock stopped advancing. A frozen sensor
   * blocks actuation and cannot be overridden; it clears only on explicit reset
   * (re-handshake). Reads are unaffected.
   */
  frozenSensorIds?: ReadonlySet<string>;
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
    const { command, capabilityLimits, sensorReadings } = context;
    const interlockOverrides = context.interlockOverrides ?? [];
    const frozenSensorIds = context.frozenSensorIds ?? new Set<string>();
    const nowMs = context.nowMs ?? Date.now();

    const capability = capabilityLimits.find(
      (entry) => entry.capabilityId === command.capabilityId
    );
    if (!capability) {
      return { ok: false, reason: `unsupported_capability:${command.capabilityId}` };
    }
    if (capability.actuation && !Number.isFinite(nowMs)) {
      return { ok: false, reason: 'invalid_safety_clock:now_ms_not_finite' };
    }

    // Audits 2.3/5.2: numeric execution bounds are capability-owned and
    // generic. Malformed declarations and undeclared numeric actuation args
    // fail closed; values are rejected, never clamped.
    const boundedArguments = new Set<string>();
    if (!Array.isArray(capability.argumentLimits)) {
      return { ok: false, reason: `invalid_capability_policy:${command.capabilityId}:argument_limits_missing` };
    }
    for (const limit of capability.argumentLimits) {
      if (typeof limit.argument !== 'string' || limit.argument.length === 0) {
        return { ok: false, reason: `invalid_capability_policy:${command.capabilityId}:argument_name_missing` };
      }
      if (boundedArguments.has(limit.argument)) {
        return { ok: false, reason: `invalid_capability_policy:${command.capabilityId}:duplicate_argument_limit:${limit.argument}` };
      }
      boundedArguments.add(limit.argument);
      if (!Number.isFinite(limit.min) || !Number.isFinite(limit.max) || limit.min > limit.max) {
        return { ok: false, reason: `invalid_capability_policy:${command.capabilityId}:invalid_range:${limit.argument}` };
      }
      const value = command.args[limit.argument];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { ok: false, reason: `invalid_argument:${limit.argument}_not_finite_numeric` };
      }
      if (value < limit.min || value > limit.max) {
        const reasonCode = limit.argument === 'angle' ? 'angle_out_of_range' : 'argument_out_of_range';
        return {
          ok: false,
          reason: `${reasonCode}:${limit.argument}=${value} not in [${limit.min}, ${limit.max}]`
        };
      }
    }
    if (capability.actuation) {
      for (const [argument, value] of Object.entries(command.args)) {
        if (typeof value === 'number' && !boundedArguments.has(argument)) {
          return { ok: false, reason: `unbounded_numeric_argument:${command.capabilityId}:${argument}` };
        }
      }
    }

    // A caller-supplied override may only apply to a sensor this capability
    // actually declares an interlock for; injecting an override for an unknown
    // sensor is an explicit failure, never silently ignored (invariant 3).
    const declaredSensorIds = new Set(
      capability.requiredSensorInterlocks.map((requirement) => requirement.sensorId)
    );
    const seenOverrideSensorIds = new Set<string>();
    for (const override of interlockOverrides) {
      if (!declaredSensorIds.has(override.sensorId)) {
        return {
          ok: false,
          reason: `invalid_interlock_override:${override.sensorId}:no_declared_interlock_for_sensor`
        };
      }
      if (seenOverrideSensorIds.has(override.sensorId)) {
        return { ok: false, reason: `invalid_interlock_override:${override.sensorId}:duplicate` };
      }
      seenOverrideSensorIds.add(override.sensorId);
      if (!Number.isFinite(override.minSafeDistanceCm) || override.minSafeDistanceCm < 0) {
        return {
          ok: false,
          reason: `invalid_interlock_override:${override.sensorId}:threshold_not_finite_nonnegative`
        };
      }
    }

    // Sensor interlocks only gate actuation; pure reads stay allowed so the
    // operator can still observe the world while actuation is locked out.
    // Requirements come from the capability declaration (audit 2.1): a caller
    // cannot omit them to skip the interlock.
    if (capability.actuation) {
      for (const requirement of capability.requiredSensorInterlocks) {
        const reading = sensorReadings.find((entry) => entry.sensorId === requirement.sensorId);
        if (!reading) {
          return { ok: false, reason: `sensor_missing:${requirement.sensorId}` };
        }
        if (reading.capabilityId !== requirement.capabilityId || reading.unit !== requirement.unit) {
          return {
            ok: false,
            reason: `sensor_type_mismatch:${requirement.sensorId}:expected=${requirement.capabilityId}/${requirement.unit}:actual=${reading.capabilityId}/${reading.unit}`
          };
        }
        // Device-side timestamp is REQUIRED for actuation (audit 2.2, decision 2):
        // without it we cannot judge real freshness, and falling back to host
        // arrival time is a known-failed, silent substitution (invariant 3).
        if (reading.deviceTimestampMs === undefined) {
          return { ok: false, reason: `device_timestamp_unavailable:${requirement.sensorId}` };
        }
        if (!Number.isFinite(reading.deviceTimestampMs) || reading.deviceTimestampMs < 0) {
          return { ok: false, reason: `device_timestamp_invalid:${requirement.sensorId}` };
        }
        // Frozen sensors block actuation and CANNOT be overridden (audit 2.2,
        // decision 3); the latch clears only on explicit reset (re-handshake).
        if (frozenSensorIds.has(requirement.sensorId)) {
          return { ok: false, reason: `sensor_frozen:${requirement.sensorId}` };
        }
        if (!Number.isFinite(reading.timestampMs)) {
          return { ok: false, reason: `sensor_timestamp_invalid:${requirement.sensorId}` };
        }
        const ageMs = nowMs - reading.timestampMs;
        if (ageMs < 0) {
          return { ok: false, reason: `sensor_timestamp_future:${requirement.sensorId}:age_ms=${ageMs}` };
        }
        if (ageMs > requirement.maxAgeMs) {
          return {
            ok: false,
            reason: `sensor_stale:${requirement.sensorId}:age_ms=${ageMs}>max_age_ms=${requirement.maxAgeMs}`
          };
        }
        if (
          !Number.isFinite(reading.value)
          || reading.value < requirement.minPlausibleValue
          || reading.value > requirement.maxPlausibleValue
        ) {
          return {
            ok: false,
            reason: `sensor_invalid:${requirement.sensorId}:value=${reading.value} not in [${requirement.minPlausibleValue}, ${requirement.maxPlausibleValue}]`
          };
        }

        // Effective safe distance = the TIGHTER of the capability baseline and
        // any per-call override. An override below the baseline is rejected
        // explicitly (invariant 3: no silent correction), and the caller's raw
        // requested value is preserved in the reason for the audit trail.
        const override = interlockOverrides.find((entry) => entry.sensorId === requirement.sensorId);
        let effectiveMinSafeDistanceCm = requirement.minSafeDistanceCm;
        if (override !== undefined) {
          if (requirement.minSafeDistanceCm === undefined) {
            return {
              ok: false,
              reason: `invalid_interlock_override:${requirement.sensorId}:no_baseline_distance_to_override:requested=${override.minSafeDistanceCm}`
            };
          }
          if (override.minSafeDistanceCm < requirement.minSafeDistanceCm) {
            return {
              ok: false,
              reason: `invalid_interlock_override:${requirement.sensorId}:requested=${override.minSafeDistanceCm}<baseline=${requirement.minSafeDistanceCm}`
            };
          }
          effectiveMinSafeDistanceCm = override.minSafeDistanceCm;
        }

        if (effectiveMinSafeDistanceCm !== undefined && reading.value < effectiveMinSafeDistanceCm) {
          return {
            ok: false,
            reason: `min_safe_distance_violation:${requirement.sensorId}:distance_cm=${reading.value}<min=${effectiveMinSafeDistanceCm}`
          };
        }
      }
    }

    return { ok: true, reason: 'hardware_command_allowed' };
  }
}
