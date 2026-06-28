import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { ActionPlanSummary } from '@/lib/action-runtime/ActionPlan';
import type {
  DeviceManifest,
  Goal,
  OpenRealityRuntimeResult,
  RuntimeDecisionStatus,
  SafetyDecision,
  SupportLevel
} from '@/lib/open-reality-runtime/types';
import type { DeviceProfile } from '@/types/deviceMeta';
import type { SafetyReport } from '@/types/safety';
import type { TaskDSL } from '@/types/taskDsl';
import type { ExecutionTimelineEvent, LabReport, TimelineStateSnapshot } from '@/lib/virtual-lab/LabReport';

function emptyTaskDsl(prompt: string): TaskDSL {
  return {
    task_id: `audit-${Date.now()}`,
    intent: prompt,
    risk_level: 'low',
    steps: []
  };
}

function deriveGoalFromTaskDsl(taskDsl: TaskDSL | null | undefined): Goal | null {
  const firstStep = taskDsl?.steps[0];
  if (!firstStep) return null;
  const goalType: Goal['goalType'] = ({
    scan_area: 'scan_area',
    identify_object: 'pick_and_place',
    move_to_pose: 'pick_and_place',
    grasp: 'pick_and_place',
    release: 'pick_and_place',
    return_home: 'return_home',
    throw_object: 'throw_object',
    navigate_to: 'inspect',
    dock: 'return_home',
    set_light: firstStep.value ? 'turn_on' : 'turn_off',
    set_brightness: 'set_brightness',
    set_color: 'set_color',
    capture_frame: 'capture_image',
    read_sensor: 'read_state',
    read_register: 'read_state',
    write_register: 'set_value',
    start_sequence: 'test',
    stop_sequence: 'stop',
    read_measurement: 'measure',
    set_parameter: 'set_value',
    start_test: 'test',
    stop_test: 'stop',
    scan_slot: 'scan_area',
    reserve_slot: 'route_item',
    release_slot: 'route_item',
    mark_item: 'inspect',
    calibrate_sensor: 'inspect',
    reset_sensor: 'stop',
    start_belt: 'convey_item',
    stop_belt: 'stop',
    sort_item: 'sort_item'
  } as const)[firstStep.action];
  return {
    goalType,
    targetDeviceId: 'unknown',
    targetZone: firstStep.zone ?? firstStep.target,
    precisionRequirement: 'low',
    riskHint: taskDsl?.risk_level ?? 'low',
    ambiguity: 'clear',
    desiredState: firstStep.value === undefined ? undefined : { value: firstStep.value }
  };
}

function deriveCapabilities(taskDsl: TaskDSL | null | undefined) {
  return {
    required: taskDsl?.steps.map((step) => step.action) ?? [],
    missing: []
  };
}

function syntheticSafetyDecision(
  status: RuntimeDecisionStatus | 'proposed_plan',
  reason: string,
  supportLevel: SupportLevel,
  taskDsl: TaskDSL | null | undefined
): SafetyDecision {
  const allowedExecutionMode =
    status === 'compiled'
      ? taskDsl && 'executionMode' in taskDsl && taskDsl.executionMode === 'read_only'
        ? 'read_only'
        : 'simulation_only'
      : status === 'ask_human' || status === 'proposed_plan'
        ? 'ask_human'
        : 'blocked';

  return {
    status:
      status === 'compiled'
        ? 'allowed'
        : status === 'ambiguous'
          ? 'ambiguous'
          : status === 'not_runnable'
            ? 'not_runnable'
            : status === 'unsupported'
              ? 'unsupported'
              : status === 'ask_human' || status === 'proposed_plan'
                ? 'ask_human'
                : 'blocked',
    reason,
    safetyEnvelope: {
      allowedExecutionMode,
      requiresSimulation: allowedExecutionMode === 'simulation_only' || supportLevel === 'simulation_only',
      requiresHumanApproval: allowedExecutionMode === 'ask_human',
      maxSpeed: 'slow',
      maxForce: 'low',
      allowedZones: [],
      forbiddenZones: [],
      collisionCheckRequired: false,
      reason
    }
  };
}

function syntheticSafetyReport(
  status: RuntimeDecisionStatus | 'proposed_plan',
  reason: string,
  userFacingMessage: string
): SafetyReport {
  return {
    status: status === 'ask_human' || status === 'ambiguous' || status === 'proposed_plan' ? 'needs_confirmation' : status === 'compiled' ? 'pass' : 'blocked',
    score: status === 'compiled' ? 0.05 : status === 'ask_human' || status === 'ambiguous' || status === 'proposed_plan' ? 0.45 : 0.95,
    checks: [
      {
        id: status,
        label: userFacingMessage,
        status: status === 'compiled' ? 'pass' : status === 'ask_human' || status === 'ambiguous' || status === 'proposed_plan' ? 'warning' : 'fail',
        reason
      }
    ],
    blocked_reasons: status === 'compiled' ? [] : [reason],
    summary: userFacingMessage
  };
}

function buildTargetDevice(profile: DeviceProfile) {
  return {
    device_id: profile.deviceMeta.device_id,
    device_type: profile.deviceMeta.device_type,
    profile_id: profile.id,
    display_name: profile.deviceMeta.display_name ?? profile.label ?? profile.id
  };
}

export function buildExecutionLabReport({
  profile,
  scenarioId,
  prompt,
  taskDsl,
  safetyReport,
  adapterCommands,
  actionPlans,
  deviceStateBefore,
  deviceStateAfter,
  executionTimeline,
  stateSnapshots,
  result,
  runtimeResult
}: {
  profile: DeviceProfile;
  scenarioId: string;
  prompt: string;
  taskDsl: TaskDSL;
  safetyReport: SafetyReport;
  adapterCommands: AdapterCommand[];
  actionPlans: ActionPlanSummary[];
  deviceStateBefore: Record<string, unknown>;
  deviceStateAfter: Record<string, unknown>;
  executionTimeline: ExecutionTimelineEvent[];
  stateSnapshots: TimelineStateSnapshot[];
  result: 'pass' | 'blocked' | 'failed';
  runtimeResult?: OpenRealityRuntimeResult | null;
}): LabReport {
  const createdAt = new Date().toISOString();
  const supportLevel = runtimeResult?.taskDsl?.executionMode === 'read_only' ? 'read_only' : 'simulation_only';
  const safetyDecision = runtimeResult?.safetyDecision ?? syntheticSafetyDecision('compiled', result, supportLevel, taskDsl);

  return {
    lab_run_id: `lab-${Date.now()}`,
    device_profile: profile.id,
    scenario: scenarioId,
    prompt,
    status: runtimeResult?.status ?? 'compiled',
    created_at: createdAt,
    target_device: buildTargetDevice(profile),
    goal: runtimeResult?.goal ?? deriveGoalFromTaskDsl(taskDsl),
    capabilities: runtimeResult
      ? { required: runtimeResult.plan.requiredCapabilities, missing: runtimeResult.plan.missingCapabilities }
      : deriveCapabilities(taskDsl),
    safety_decision: safetyDecision,
    execution_mode: safetyDecision.safetyEnvelope.allowedExecutionMode,
    reason: runtimeResult?.reason ?? `execution_${result}`,
    user_facing_message: runtimeResult?.userFacingMessage ?? `Execution ${result}.`,
    task_dsl: taskDsl,
    safety_report: safetyReport,
    adapter_commands: adapterCommands,
    action_plans: actionPlans,
    device_state_before: deviceStateBefore,
    device_state_after: deviceStateAfter,
    execution_timeline: executionTimeline,
    state_snapshots: stateSnapshots,
    result
  };
}

export function buildRuntimeDecisionLabReport({
  profile,
  scenarioId,
  prompt,
  runtimeResult
}: {
  profile: DeviceProfile;
  scenarioId: string;
  prompt: string;
  runtimeResult: OpenRealityRuntimeResult;
}): LabReport {
  const taskDsl = runtimeResult.taskDsl ?? emptyTaskDsl(prompt);
  const safetyDecision = runtimeResult.safetyDecision;
  const safetyReport = syntheticSafetyReport(runtimeResult.status, runtimeResult.reason, runtimeResult.userFacingMessage);

  return {
    lab_run_id: `lab-${Date.now()}`,
    device_profile: profile.id,
    scenario: scenarioId,
    prompt,
    status: runtimeResult.status,
    created_at: new Date().toISOString(),
    target_device: buildTargetDevice(profile),
    goal: runtimeResult.goal,
    capabilities: {
      required: runtimeResult.plan.requiredCapabilities,
      missing: runtimeResult.plan.missingCapabilities
    },
    safety_decision: safetyDecision,
    execution_mode: safetyDecision.safetyEnvelope.allowedExecutionMode,
    reason: runtimeResult.reason,
    user_facing_message: runtimeResult.userFacingMessage,
    task_dsl: taskDsl,
    safety_report: safetyReport,
    adapter_commands: [],
    action_plans: [],
    device_state_before: {},
    device_state_after: {},
    execution_timeline: [],
    state_snapshots: [],
    result: runtimeResult.status === 'blocked' || runtimeResult.status === 'not_runnable' || runtimeResult.status === 'unsupported' ? 'blocked' : 'failed'
  };
}

export function buildAutonomyStopLabReport({
  profile,
  scenarioId,
  prompt,
  runtimeResult,
  autonomyStatus,
  reason
}: {
  profile: DeviceProfile;
  scenarioId: string;
  prompt: string;
  runtimeResult: OpenRealityRuntimeResult;
  autonomyStatus: 'block' | 'ask_human' | 'proposed_plan';
  reason: string;
}): LabReport {
  const mappedStatus = autonomyStatus === 'block' ? 'blocked' : autonomyStatus === 'ask_human' ? 'ask_human' : 'proposed_plan';
  const taskDsl = runtimeResult.taskDsl ?? emptyTaskDsl(prompt);
  const safetyDecision =
    mappedStatus === 'blocked'
      ? syntheticSafetyDecision('blocked', reason, 'simulation_only', taskDsl)
      : syntheticSafetyDecision(mappedStatus, reason, 'simulation_only', taskDsl);
  const safetyReport = syntheticSafetyReport(mappedStatus, reason, runtimeResult.userFacingMessage);

  return {
    lab_run_id: `lab-${Date.now()}`,
    device_profile: profile.id,
    scenario: scenarioId,
    prompt,
    status: mappedStatus,
    created_at: new Date().toISOString(),
    target_device: buildTargetDevice(profile),
    goal: runtimeResult.goal,
    capabilities: {
      required: runtimeResult.plan.requiredCapabilities,
      missing: runtimeResult.plan.missingCapabilities
    },
    safety_decision: safetyDecision,
    execution_mode: safetyDecision.safetyEnvelope.allowedExecutionMode,
    reason,
    user_facing_message: runtimeResult.userFacingMessage,
    task_dsl: taskDsl,
    safety_report: safetyReport,
    adapter_commands: [],
    action_plans: [],
    device_state_before: {},
    device_state_after: {},
    execution_timeline: [],
    state_snapshots: [],
    result: mappedStatus === 'blocked' ? 'blocked' : 'failed'
  };
}
