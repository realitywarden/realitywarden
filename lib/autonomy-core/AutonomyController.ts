import type { PlanCandidate } from './Planner';
import type { RiskResult } from './RiskJudge';
import type { AutonomyContext, AutonomyLevel } from './AutonomyLevel';

export class AutonomyController {
  decide(risk: RiskResult, plan: PlanCandidate | undefined, context: AutonomyContext = {}) {
    const level: AutonomyLevel = context.autonomy_level ?? 'L3_supervised_agent';
    const mode = context.mode ?? 'simulation';
    if (mode === 'live') {
      return { status: 'block' as const, autonomy_level: level, reason: 'live mode is blocked in v0.1.' };
    }
    if (plan?.type === 'proposed_plan') {
      return { status: 'proposed_plan' as const, autonomy_level: level, reason: 'Plan requires human confirmation.' };
    }
    if (level === 'L0_manual') {
      return { status: 'ask_human' as const, autonomy_level: level, reason: 'L0_manual never executes automatically.' };
    }
    if (risk.decision === 'block') return { status: 'block' as const, autonomy_level: level, reason: risk.reasons.join(' ') };
    if (risk.decision === 'ask_human') return { status: 'ask_human' as const, autonomy_level: level, reason: risk.reasons.join(' ') };
    if (level === 'L1_scripted' && plan?.type !== 'pick_and_place' && plan?.type !== 'return_home') {
      return { status: 'ask_human' as const, autonomy_level: level, reason: 'L1_scripted only executes explicit low-risk scripted tasks.' };
    }
    if (level === 'L5_free_sandbox' && mode === 'simulation') {
      return { status: 'execute' as const, autonomy_level: level, reason: 'L5 allowed only in simulation sandbox.' };
    }
    return { status: 'execute' as const, autonomy_level: level, reason: 'Risk judged executable for current autonomy level.' };
  }
}
