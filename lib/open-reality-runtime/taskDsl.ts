import type { OpenRealityTaskDSL, RuntimePlan, Goal, SafetyDecision, DeviceManifest } from './types';

export function buildTaskDsl(
  originalPrompt: string,
  goal: Goal,
  plan: RuntimePlan,
  safetyDecision: SafetyDecision,
  manifest: DeviceManifest
): OpenRealityTaskDSL {
  return {
    task_id: `or-task-${Date.now()}`,
    intent: originalPrompt,
    risk_level: goal.riskHint === 'critical' ? 'high' : goal.riskHint === 'medium' ? 'medium' : 'low',
    targetDeviceId: goal.targetDeviceId,
    deviceCategory: manifest.category,
    goalType: goal.goalType,
    steps: plan.steps.map((step) => ({
      id: step.stepId,
      action: step.action,
      target: step.target,
      speed: step.speed,
      force: step.force,
      value: step.value,
      zone: step.zone,
      note: step.note,
      capabilityId: step.capabilityId,
      constraints: {
        maxSpeed: safetyDecision.safetyEnvelope.maxSpeed,
        maxForce: safetyDecision.safetyEnvelope.maxForce
      }
    })),
    safetyEnvelope: safetyDecision.safetyEnvelope,
    executionMode: manifest.supportLevel === 'read_only' ? 'read_only' : 'simulation_only',
    humanApprovalRequired: safetyDecision.status === 'ask_human',
    audit: {
      originalPrompt,
      targetDeviceId: goal.targetDeviceId,
      compilerVersion: 'open-reality-runtime-kernel.v0.2-sprint0',
      generatedAt: new Date().toISOString()
    }
  };
}
