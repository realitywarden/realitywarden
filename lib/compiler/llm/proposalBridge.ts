/**
 * Proposal bridge: deterministic mapping from a schema-validated LLM TaskDSL
 * proposal to the structured inputs the existing pipelines already consume
 * (runtime kernel `Goal` + autonomy `SemanticIntent`).
 *
 * The LLM stays strictly upstream of every safety layer: the bridge only
 * widens language understanding. Grounding, affordance, planning, consequence
 * simulation, RiskJudge, AutonomyController, SafetyGovernor and SafetyMonitor
 * all run unchanged on the bridged values — a cooperating-malicious proposal
 * (e.g. throw / outside_table) maps to exactly the goal shapes those layers
 * already block.
 *
 * The mapping is CONSERVATIVE: if a proposal does not map with confidence,
 * the bridge returns null and the caller falls back to the rules compiler —
 * explicitly and with an audit entry (no silent fallback).
 */
import type { SemanticIntent } from '@/lib/autonomy-core/SemanticIntent';
import type { GoalCompileResult } from '@/lib/open-reality-runtime/types';
import type { TaskDSL } from '@/types/taskDsl';

export interface BridgedProposal {
  goalOverride: GoalCompileResult;
  semanticIntentOverride: SemanticIntent;
}

const OBJECT_QUERY: Record<string, SemanticIntent['object_query']> = {
  red_cube: 'red cube',
  blue_cube: 'blue cube'
};

const REGION_QUERY: Record<string, SemanticIntent['target_query']> = {
  back_safe_zone: 'back area',
  front_safe_zone: 'front area',
  left_safe_zone: 'left area',
  right_safe_zone: 'right area',
  outside_table: 'outside table',
  glass_cup: 'glass cup area'
};

const KERNEL_ZONES = new Set([
  'back_safe_zone',
  'front_safe_zone',
  'left_safe_zone',
  'right_safe_zone',
  'outside_table'
]);

export function bridgeProposalToRuntime(
  prompt: string,
  taskDsl: TaskDSL,
  targetDeviceId: string
): BridgedProposal | null {
  const steps = taskDsl.steps;
  const actions = steps.map((step) => step.action);
  const references = steps.flatMap((step) =>
    [step.target, step.zone].filter((value): value is string => typeof value === 'string'));

  const objectRef = references.find((ref) => ref in OBJECT_QUERY);
  const zoneRefs = references.filter((ref) => KERNEL_ZONES.has(ref));
  const targetZone = zoneRefs.length > 0 ? zoneRefs[zoneRefs.length - 1] : undefined;

  const isThrow = actions.includes('throw_object') || references.includes('outside_table');
  const isPickAndPlace = actions.includes('grasp') && actions.includes('release');
  const isReturnHome = actions.length > 0 && actions.every((action) => action === 'return_home');

  let goalType: GoalCompileResult['goal']['goalType'];
  let semanticGoal: SemanticIntent['goal'];
  if (isThrow) {
    goalType = 'throw_object';
    semanticGoal = 'throw_object';
  } else if (isPickAndPlace) {
    // Placement needs a grounded object and zone; anything less falls back to
    // the rules compiler rather than being guessed at.
    if (!objectRef || !targetZone) return null;
    goalType = 'pick_and_place';
    semanticGoal = 'move_object';
  } else if (isReturnHome) {
    goalType = 'return_home';
    semanticGoal = 'return_home';
  } else {
    return null;
  }

  const semanticTargetRef = references.find((ref) => ref in REGION_QUERY);

  return {
    goalOverride: {
      goal: {
        goalType,
        targetDeviceId,
        objectRef,
        targetZone: isThrow ? (targetZone ?? 'outside_table') : targetZone,
        precisionRequirement: 'medium',
        riskHint: isThrow ? 'critical' : 'low',
        ambiguity: 'clear'
      },
      confidence: 0.9,
      reason: 'llm_proposal'
    },
    semanticIntentOverride: {
      goal: semanticGoal,
      object_query: objectRef ? OBJECT_QUERY[objectRef] : null,
      target_query: isThrow
        ? 'outside table'
        : semanticTargetRef
          ? REGION_QUERY[semanticTargetRef]
          : null,
      confidence: 0.9,
      raw_prompt: prompt
    }
  };
}
