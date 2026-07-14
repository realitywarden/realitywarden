import { getSimulationAdapterForManifest } from '@/lib/adapter-sdk';
import type { AutonomyResult } from '@/lib/autonomy-core/AutonomyResult';
import { AutonomyCore } from '@/lib/autonomy-core/AutonomyCore';
import type { CompileWithFallbackResult } from '@/lib/compiler/llm/compileWithFallback';
import { bridgeProposalToRuntime } from '@/lib/compiler/llm/proposalBridge';
import type { BridgedProposal } from '@/lib/compiler/llm/proposalBridge';
import { buildManifestFromProfile } from '@/lib/open-reality-runtime/deviceManifests';
import { compileOpenRealityRuntime } from '@/lib/open-reality-runtime/runtimeKernel';
import type {
  GoalType,
  OpenRealityTaskDSL,
  RuntimeDecisionStatus
} from '@/lib/open-reality-runtime/types';
import { buildWorldModelFromProfile } from '@/lib/open-reality-runtime/worldModel';
import type { DeviceProfile } from '@/types/deviceMeta';
import type { TaskDSL, TaskStep } from '@/types/taskDsl';
import type { LocalRuntimeSession } from './ExecutionSession';
import { RuntimeAuditLog } from './RuntimeAuditLog';
import { SafetyMonitor } from './SafetyMonitor';

function capabilityIdForAction(action: TaskStep['action']): string {
  const map: Record<TaskStep['action'], string> = {
    scan_area: 'scan',
    identify_object: 'detect_object',
    move_to_pose: 'move_to_pose',
    grasp: 'grasp',
    release: 'release',
    return_home: 'return_home',
    throw_object: 'move_to_pose',
    navigate_to: 'move',
    dock: 'return_home',
    set_light: 'turn_on',
    set_brightness: 'set_brightness',
    set_color: 'set_color',
    capture_frame: 'capture_image',
    read_sensor: 'read_sensor',
    read_register: 'read_sensor',
    write_register: 'set_value',
    start_sequence: 'test',
    stop_sequence: 'stop',
    read_measurement: 'measure',
    set_parameter: 'set_value',
    start_test: 'test',
    stop_test: 'stop',
    scan_slot: 'scan',
    reserve_slot: 'route',
    release_slot: 'route',
    mark_item: 'inspect',
    calibrate_sensor: 'inspect',
    reset_sensor: 'stop',
    start_belt: 'convey',
    stop_belt: 'stop',
    sort_item: 'sort'
  };
  return map[action];
}

function mergeExecutableTaskDsl(
  baseTaskDsl: OpenRealityTaskDSL,
  taskDsl: TaskDSL,
  goalType?: GoalType
): OpenRealityTaskDSL {
  return {
    ...baseTaskDsl,
    goalType: goalType ?? baseTaskDsl.goalType,
    risk_level: taskDsl.risk_level,
    steps: taskDsl.steps.map((step) => ({
      ...step,
      capabilityId: capabilityIdForAction(step.action),
      constraints: {
        maxSpeed: baseTaskDsl.safetyEnvelope.maxSpeed,
        maxForce: baseTaskDsl.safetyEnvelope.maxForce
      }
    })),
    audit: {
      ...baseTaskDsl.audit,
      generatedAt: new Date().toISOString()
    }
  };
}

function finalStatusFromAutonomy(
  autonomyResult: AutonomyResult
): RuntimeDecisionStatus | 'proposed_plan' {
  if (autonomyResult.status === 'block') return 'blocked';
  if (autonomyResult.status === 'ask_human') return 'ask_human';
  if (autonomyResult.status === 'simulate_only') return 'blocked';
  if (autonomyResult.status === 'proposed_plan') return 'proposed_plan';
  return 'compiled';
}

function finalMessageFromAutonomy(
  locale: 'zh' | 'en',
  autonomyResult: AutonomyResult
): string {
  const reason = autonomyResult.risk_result.reasons.join('; ') || autonomyResult.status;
  if (locale === 'zh') {
    if (autonomyResult.status === 'block') return `已阻止：${reason}`;
    if (autonomyResult.status === 'ask_human') return `需要人工确认：${reason}`;
    if (autonomyResult.status === 'proposed_plan') return '建议计划：需要确认';
    return `未执行：${reason}`;
  }
  if (autonomyResult.status === 'block') return `Blocked: ${reason}`;
  if (autonomyResult.status === 'ask_human') return `Ask Human: ${reason}`;
  if (autonomyResult.status === 'proposed_plan') {
    return 'Proposed Plan: confirmation required';
  }
  return `Execution stopped: ${reason}`;
}

export class LocalRuntime {
  private readonly safetyMonitor = new SafetyMonitor();

  prepareSimulationSession({
    profile,
    prompt,
    locale,
    deviceState,
    llmCompile,
    manifestCompile
  }: {
    profile: DeviceProfile;
    prompt: string;
    locale: 'zh' | 'en';
    deviceState?: Record<string, unknown> | null;
    /**
     * Optional result of the LLM-first compile attempt. The proposal inside is
     * UNTRUSTED: it is bridged to the structured inputs the existing pipelines
     * consume, and every safety layer runs unchanged on the bridged values.
     * If bridging declines or the LLM already fell back, the rules path runs
     * exactly as before - explicitly audited, never silently.
     */
    llmCompile?: CompileWithFallbackResult;
    /**
     * Optional pre-expanded Action Manifest TaskDSL (v0.4 custom actions).
     * UNTRUSTED like any proposal: it is bridged and every safety layer runs
     * unchanged on the bridged values. Compiler provenance is audited as
     * 'manifest', never disguised as llm/rules.
     */
    manifestCompile?: { taskDsl: TaskDSL; actionId: string };
  }): LocalRuntimeSession {
    const audit = new RuntimeAuditLog();
    const manifest = buildManifestFromProfile(profile);
    const worldModel = buildWorldModelFromProfile(profile, {
      targetDeviceId: profile.deviceMeta.device_id,
      selected: true,
      status: deviceState ? 'selected' : 'idle'
    });

    audit.info('input', 'session_started', 'Local runtime session created.', {
      deviceId: profile.deviceMeta.device_id,
      deviceType: profile.deviceMeta.device_type,
      prompt
    });

    // -- Compiler provenance (honesty invariant: which layer produced the
    // language understanding is always audited; fallback is never silent). --
    let bridged: BridgedProposal | null = null;
    let compilerUsed: 'llm' | 'rules' | 'manifest' = 'rules';
    let compilerDetail = 'rules engine';
    if (manifestCompile) {
      bridged = profile.deviceMeta.device_type === 'robot_arm'
        ? bridgeProposalToRuntime(prompt, manifestCompile.taskDsl, profile.deviceMeta.device_id)
        : null;
      if (bridged) {
        compilerUsed = 'manifest';
        compilerDetail = `action manifest (${manifestCompile.actionId})`;
        audit.info('compiler', 'manifest_compiler_used', 'Validated action manifest expanded and bridged into the runtime pipelines.', {
          actionId: manifestCompile.actionId,
          compiler: 'manifest'
        });
      } else {
        compilerDetail = 'rules engine (manifest unmappable)';
        audit.info('compiler', 'manifest_compiler_fallback', 'Manifest expansion did not map to a known goal shape; rules compiler used.', {
          kind: 'proposal_unmappable',
          actionId: manifestCompile.actionId,
          compiler: 'rules'
        });
      }
    } else if (llmCompile && llmCompile.compiler === 'llm' && llmCompile.taskDsl) {
      bridged = profile.deviceMeta.device_type === 'robot_arm'
        ? bridgeProposalToRuntime(prompt, llmCompile.taskDsl, profile.deviceMeta.device_id)
        : null;
      if (bridged) {
        compilerUsed = 'llm';
        compilerDetail = `llm(${llmCompile.model ?? 'unknown-model'}) in ${llmCompile.elapsedMs}ms`;
        audit.info('compiler', 'llm_compiler_used', 'LLM proposal validated and bridged into the runtime pipelines.', {
          model: llmCompile.model,
          elapsedMs: llmCompile.elapsedMs,
          compiler: 'llm'
        });
      } else {
        compilerDetail = 'rules engine (llm proposal unmappable)';
        audit.info('compiler', 'llm_compiler_fallback', 'LLM proposal did not map to a known goal shape; rules compiler used.', {
          kind: 'proposal_unmappable',
          model: llmCompile.model,
          compiler: 'rules'
        });
      }
    } else if (llmCompile && llmCompile.compiler === 'rules') {
      compilerDetail = `rules engine (llm fallback: ${llmCompile.fallbackReason ?? 'unknown'})`;
      audit.info('compiler', 'llm_compiler_fallback', 'LLM compile failed; rules compiler used.', {
        kind: llmCompile.fallbackReason,
        detail: llmCompile.fallbackDetail,
        model: llmCompile.model,
        compiler: 'rules'
      });
    }

    const runtimeResult = compileOpenRealityRuntime({
      userPrompt: prompt,
      targetDeviceId: profile.deviceMeta.device_id,
      manifest,
      worldModel,
      locale,
      goalOverride: bridged?.goalOverride
    });

    audit.info(
      'runtime_kernel',
      'runtime_decision',
      `Runtime Kernel returned ${runtimeResult.status}.`,
      {
        status: runtimeResult.status,
        reason: runtimeResult.reason,
        supportLevel: manifest.supportLevel
      }
    );

    if (runtimeResult.status !== 'compiled') {
      return {
        sessionId: `local-runtime-${Date.now()}`,
        status: runtimeResult.status,
        reason: runtimeResult.reason,
        userFacingMessage: runtimeResult.userFacingMessage,
        runtimeResult,
        autonomyResult: null,
        executableTaskDsl: null,
        adapterBoundary: null,
        adapterPlan: null,
        adapterPlanValidation: null,
        adapterDryRun: null,
        compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
        canExecute: false
      };
    }

    let autonomyResult: AutonomyResult | null = null;
    let executableTaskDsl: OpenRealityTaskDSL | null = runtimeResult.taskDsl ?? null;
    let finalStatus: RuntimeDecisionStatus | 'proposed_plan' = runtimeResult.status;
    let finalReason = runtimeResult.reason;
    let finalMessage = runtimeResult.userFacingMessage;

    if (profile.deviceMeta.device_type === 'robot_arm') {
      autonomyResult = new AutonomyCore().run(prompt, {
        profile,
        autonomy_level: 'L3_supervised_agent',
        mode: 'simulation',
        device_state: deviceState ?? undefined,
        semantic_intent_override: bridged?.semanticIntentOverride
      });

      audit.info('autonomy', 'autonomy_decision', `AutonomyCore returned ${autonomyResult.status}.`, {
        status: autonomyResult.status,
        reasons: autonomyResult.risk_result.reasons,
        goal: autonomyResult.semantic_intent.goal
      });

      if (
        autonomyResult.status !== 'execute'
        || !autonomyResult.task_dsl
        || !runtimeResult.taskDsl
      ) {
        finalStatus = finalStatusFromAutonomy(autonomyResult);
        finalReason = autonomyResult.risk_result.reasons.join('; ') || autonomyResult.status;
        finalMessage = finalMessageFromAutonomy(locale, autonomyResult);

        return {
          sessionId: `local-runtime-${Date.now()}`,
          status: finalStatus,
          reason: finalReason,
          userFacingMessage: finalMessage,
          runtimeResult,
          autonomyResult,
          executableTaskDsl: null,
          adapterBoundary: null,
          adapterPlan: null,
          adapterPlanValidation: null,
          adapterDryRun: null,
          compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
          canExecute: false
        };
      }

      executableTaskDsl = mergeExecutableTaskDsl(
        runtimeResult.taskDsl,
        autonomyResult.task_dsl,
        runtimeResult.goal.goalType
      );
    }

    if (!executableTaskDsl) {
      audit.error(
        'runtime_kernel',
        'missing_task_dsl',
        'Compiled runtime session did not produce executable TaskDSL.'
      );
      return {
        sessionId: `local-runtime-${Date.now()}`,
        status: 'blocked',
        reason: 'missing_task_dsl',
        userFacingMessage: locale === 'zh'
          ? '未生成可执行 TaskDSL。'
          : 'No executable TaskDSL was generated.',
        runtimeResult,
        autonomyResult,
        executableTaskDsl: null,
        adapterBoundary: null,
        adapterPlan: null,
        adapterPlanValidation: null,
        adapterDryRun: null,
        compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
        canExecute: false
      };
    }

    const adapterBoundary = getSimulationAdapterForManifest(manifest);
    if (!adapterBoundary) {
      audit.error(
        'adapter_plan',
        'missing_adapter_boundary',
        'No simulation adapter is available for this manifest.',
        {
          supportLevel: manifest.supportLevel
        }
      );
      return {
        sessionId: `local-runtime-${Date.now()}`,
        status: 'not_runnable',
        reason: 'missing_adapter_boundary',
        userFacingMessage: locale === 'zh'
          ? '当前设备没有可用的本地仿真适配器。'
          : 'No local simulation adapter is available for this device.',
        runtimeResult,
        autonomyResult,
        executableTaskDsl,
        adapterBoundary: null,
        adapterPlan: null,
        adapterPlanValidation: null,
        adapterDryRun: null,
        compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
        canExecute: false
      };
    }

    const adapterPlan = adapterBoundary.compileTaskDslToAdapterPlan(executableTaskDsl);
    audit.info('adapter_plan', 'adapter_plan_compiled', 'TaskDSL compiled into AdapterPlan.', {
      adapterId: adapterPlan.adapterId,
      mode: adapterPlan.mode,
      stepCount: adapterPlan.steps.length,
      dryRunOnly: adapterPlan.dryRunOnly
    });

    const adapterPlanValidation = adapterBoundary.validateAdapterPlan(adapterPlan);
    const adapterDryRun = adapterBoundary.dryRun(adapterPlan);
    const safetyDecision = this.safetyMonitor.evaluateSimulationBoundary(
      manifest,
      adapterPlan,
      adapterPlanValidation,
      adapterDryRun
    );

    if (!adapterPlanValidation.ok) {
      audit.error('adapter_plan', 'adapter_plan_invalid', 'AdapterPlan validation failed.', {
        errors: adapterPlanValidation.errors
      });
    } else {
      audit.info('adapter_plan', 'adapter_plan_valid', 'AdapterPlan validation passed.', {
        mode: adapterPlan.mode
      });
    }

    if (adapterDryRun.ok) {
      audit.info('dry_run', 'adapter_dry_run_passed', 'Simulation adapter dry-run passed.', {
        simulatedStepCount: adapterDryRun.simulatedStepCount,
        mode: adapterDryRun.mode
      });
    }

    if (!safetyDecision.ok) {
      audit.error(
        'execution_gate',
        'execution_gate_blocked',
        'Local runtime blocked execution before simulation.',
        {
          reason: safetyDecision.reason
        }
      );
      return {
        sessionId: `local-runtime-${Date.now()}`,
        status: 'blocked',
        reason: safetyDecision.reason,
        userFacingMessage: locale === 'zh'
          ? `已阻止：${safetyDecision.reason}`
          : `Blocked: ${safetyDecision.reason}`,
        runtimeResult,
        autonomyResult,
        executableTaskDsl,
        adapterBoundary,
        adapterPlan,
        adapterPlanValidation,
        adapterDryRun,
        compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
        canExecute: false
      };
    }

    audit.info(
      'execution_gate',
      'simulation_only_authorized',
      'Simulation-only execution authorized.',
      {
        mode: adapterPlan.mode,
        realDeviceExecution: false
      }
    );

    return {
      sessionId: `local-runtime-${Date.now()}`,
      status: finalStatus,
      reason: finalReason,
      userFacingMessage: finalMessage,
      runtimeResult,
      autonomyResult,
      executableTaskDsl,
      adapterBoundary,
      adapterPlan,
      adapterPlanValidation,
      adapterDryRun,
      compilerUsed,
      compilerDetail,
      auditLog: audit.list(),
      canExecute: true
    };
  }
}
