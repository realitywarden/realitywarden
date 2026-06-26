import { compileGoal } from './goalCompiler';
import { buildPlan } from './planner';
import { evaluateSafety } from './safetyGovernor';
import { buildTaskDsl } from './taskDsl';
import { findWorldObject, findWorldZone } from './worldModel';
import type { Goal, OpenRealityRuntimeInput, OpenRealityRuntimeResult } from './types';

function emptyGoal(targetDeviceId: string): Goal {
  return {
    goalType: 'ambiguous_action',
    targetDeviceId,
    precisionRequirement: 'low',
    riskHint: 'low',
    ambiguity: 'ambiguous'
  };
}

function message(locale: 'zh' | 'en', key: string, fallback: string) {
  if (locale === 'zh') {
    const zh: Record<string, string> = {
      coming_soon: '当前设备在 v0.2 Sprint 0 中仍为 Coming Soon / Not Runnable。',
      ambiguous: '未能明确理解该任务，请补充目标物体或目标区域。',
      unsupported: '当前设备不支持该任务能力。',
      blocked: '该任务已被安全治理器拦截。',
      ask_human: '该任务需要人工确认后才能继续。',
      compiled: '任务已编译为 Open Reality Runtime TaskDSL。'
    };
    return zh[key] ?? fallback;
  }
  return fallback;
}

export function compileOpenRealityRuntime(input: OpenRealityRuntimeInput): OpenRealityRuntimeResult {
  const locale = input.locale ?? 'en';
  const manifest = input.manifest;

  if (manifest.supportLevel === 'coming_soon' || manifest.supportLevel === 'unsupported') {
    const goal = emptyGoal(input.targetDeviceId);
    const plan = { requiredCapabilities: [], missingCapabilities: [], steps: [], confidence: 0, reason: 'coming_soon' };
    const safetyDecision = {
      status: 'not_runnable' as const,
      safetyEnvelope: {
        allowedExecutionMode: 'blocked' as const,
        requiresSimulation: true,
        requiresHumanApproval: false,
        maxSpeed: manifest.constraints.maxSpeed,
        maxForce: manifest.constraints.maxForce,
        allowedZones: manifest.workspace.allowedZones,
        forbiddenZones: manifest.workspace.forbiddenZones,
        collisionCheckRequired: manifest.constraints.requiresCollisionCheck,
        reason: 'coming_soon'
      },
      reason: 'coming_soon'
    };
    return {
      status: 'not_runnable',
      goal,
      plan,
      safetyDecision,
      confidence: 0,
      reason: 'coming_soon',
      userFacingMessage: message(locale, 'coming_soon', 'This device is Coming Soon / Not Runnable in v0.2 Sprint 0.')
    };
  }

  const compiledGoal = compileGoal(input);
  const goal = compiledGoal.goal;

  if (goal.goalType === 'unsupported_goal') {
    const plan = buildPlan(goal, manifest);
    const safetyDecision = evaluateSafety(goal, plan, manifest);
    return {
      status: 'unsupported',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence,
      reason: 'unsupported_goal',
      userFacingMessage: message(locale, 'unsupported', 'The selected device does not support this task.')
    };
  }

  if (goal.ambiguity !== 'clear') {
    const plan = buildPlan(goal, manifest);
    const safetyDecision = evaluateSafety(goal, plan, manifest);
    return {
      status: 'ambiguous',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence,
      reason: compiledGoal.reason,
      userFacingMessage: message(locale, 'ambiguous', 'The prompt is ambiguous. Clarify the object or target zone.')
    };
  }

  if (goal.objectRef && !findWorldObject(input.worldModel, goal.objectRef)) {
    const plan = buildPlan(goal, manifest);
    const safetyDecision = evaluateSafety({ ...goal, ambiguity: 'ambiguous' }, plan, manifest);
    return {
      status: 'ambiguous',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence * 0.5,
      reason: 'missing_object_in_world_model',
      userFacingMessage: message(locale, 'ambiguous', 'The world model does not contain the requested object.')
    };
  }

  if (goal.targetZone && !findWorldZone(input.worldModel, goal.targetZone)) {
    const plan = buildPlan(goal, manifest);
    const safetyDecision = evaluateSafety({ ...goal, ambiguity: 'ambiguous' }, plan, manifest);
    return {
      status: 'ambiguous',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence * 0.5,
      reason: 'missing_target_zone_in_world_model',
      userFacingMessage: message(locale, 'ambiguous', 'The world model does not contain the requested target zone.')
    };
  }

  const plan = buildPlan(goal, manifest);
  const safetyDecision = evaluateSafety(goal, plan, manifest);

  if (safetyDecision.status === 'blocked') {
    return {
      status: 'blocked',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence,
      reason: safetyDecision.reason,
      userFacingMessage: message(locale, 'blocked', 'The requested task was blocked by the Safety Governor.')
    };
  }

  if (safetyDecision.status === 'unsupported') {
    return {
      status: 'unsupported',
      goal,
      plan,
      safetyDecision,
      confidence: compiledGoal.confidence,
      reason: safetyDecision.reason,
      userFacingMessage: message(locale, 'unsupported', 'The selected device does not support this task.')
    };
  }

  const taskDsl = buildTaskDsl(input.userPrompt, goal, plan, safetyDecision, manifest);

  if (safetyDecision.status === 'ask_human') {
    return {
      status: 'ask_human',
      goal,
      plan,
      safetyDecision,
      taskDsl,
      confidence: compiledGoal.confidence,
      reason: safetyDecision.reason,
      userFacingMessage: message(locale, 'ask_human', 'Human approval is required before continuing.')
    };
  }

  return {
    status: 'compiled',
    goal,
    plan,
    safetyDecision,
    taskDsl,
    confidence: compiledGoal.confidence,
    reason: 'compiled',
    userFacingMessage: message(locale, 'compiled', 'Open Reality Runtime compiled the task successfully.')
  };
}
