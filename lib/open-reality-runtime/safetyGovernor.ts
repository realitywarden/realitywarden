import type { DeviceManifest, Goal, RuntimePlan, SafetyDecision } from './types';

export function evaluateSafety(goal: Goal, plan: RuntimePlan, manifest: DeviceManifest): SafetyDecision {
  const envelope: SafetyDecision['safetyEnvelope'] = {
    allowedExecutionMode: manifest.supportLevel === 'read_only' ? 'read_only' : 'simulation_only',
    requiresSimulation: true,
    requiresHumanApproval: false,
    maxSpeed: manifest.constraints.maxSpeed,
    maxForce: manifest.constraints.maxForce,
    allowedZones: manifest.workspace.allowedZones,
    forbiddenZones: manifest.workspace.forbiddenZones,
    collisionCheckRequired: manifest.constraints.requiresCollisionCheck,
    reason: 'allowed'
  };

  if (manifest.supportLevel === 'coming_soon' || manifest.supportLevel === 'unsupported') {
    return {
      status: 'not_runnable',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'blocked', reason: 'coming_soon' },
      reason: 'coming_soon'
    };
  }

  if (goal.ambiguity !== 'clear') {
    return {
      status: 'ambiguous',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'ask_human', requiresHumanApproval: true, reason: 'ambiguous_goal' },
      reason: 'ambiguous_goal'
    };
  }

  if (plan.missingCapabilities.length > 0 || goal.goalType === 'unsupported_goal') {
    return {
      status: 'unsupported',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'blocked', reason: 'unsupported_capability' },
      reason: 'unsupported_capability'
    };
  }

  if (
    manifest.riskProfile.blockedGoals.includes(goal.goalType) ||
    goal.goalType === 'throw_object' ||
    goal.goalType === 'smash_object' ||
    goal.goalType === 'move_outside_workspace' ||
    goal.goalType === 'destructive_action' ||
    goal.targetZone === 'outside_table' ||
    goal.targetZone === 'forbidden_outside_table'
  ) {
    return {
      status: 'blocked',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'blocked', reason: 'unsafe_goal' },
      reason: 'unsafe_goal'
    };
  }

  if (goal.precisionRequirement === 'high') {
    return {
      status: 'ask_human',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'ask_human', requiresHumanApproval: true, reason: 'high_precision_requires_human' },
      reason: 'high_precision_requires_human'
    };
  }

  if (manifest.supportLevel === 'read_only' && plan.requiredCapabilities.some((capabilityId) => ['move_to_pose', 'grasp', 'release', 'pick', 'place', 'turn_on', 'turn_off', 'set_color', 'set_brightness', 'set_speed', 'set_temperature', 'set_value'].includes(capabilityId))) {
    return {
      status: 'unsupported',
      safetyEnvelope: { ...envelope, allowedExecutionMode: 'blocked', reason: 'read_only_device' },
      reason: 'read_only_device'
    };
  }

  return {
    status: 'allowed',
    safetyEnvelope: envelope,
    reason: 'allowed'
  };
}
