import type { AdapterDryRunResult, AdapterPlan, AdapterPlanValidationResult } from '@/lib/adapter-sdk';
import type { DeviceManifest } from '@/lib/open-reality-runtime/types';

export interface SafetyMonitorDecision {
  ok: boolean;
  reason: string;
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
}

