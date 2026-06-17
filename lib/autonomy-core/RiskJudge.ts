import type { AffordanceResult } from './AffordanceModel';
import type { ConsequenceResult } from './ConsequenceSimulator';
import type { SemanticIntent } from './SemanticIntent';
import type { GroundingResult } from './WorldModel';

export interface RiskResult {
  decision: 'execute' | 'ask_human' | 'simulate_only' | 'block';
  risk_score: number;
  uncertainty: number;
  reasons: string[];
}

export class RiskJudge {
  judge(intent: SemanticIntent, grounding: GroundingResult, affordance: AffordanceResult, consequence: ConsequenceResult): RiskResult {
    const reasons = [...grounding.errors, ...affordance.reasons, ...consequence.reasons].map(String);
    if (intent.goal === 'throw_object') reasons.push('throw_object is a hard boundary.');
    if (grounding.target_region_id === 'outside_table') reasons.push('outside_table is a hard boundary.');
    if (intent.goal === 'throw_object' || grounding.target_region_id === 'outside_table' || affordance.reasons.some((reason) => reason.includes('throw_object'))) {
      return { decision: 'block', risk_score: 1, uncertainty: 0.05, reasons };
    }
    if (consequence.fragile_contact_risk >= 0.8) {
      return { decision: 'ask_human', risk_score: 0.82, uncertainty: 0.22, reasons: [...reasons, 'glass_cup_neighborhood is high risk.'] };
    }
    if (grounding.errors.includes('ambiguous_object') || grounding.errors.includes('unknown_object') || grounding.errors.includes('unknown_target')) {
      return { decision: 'ask_human', risk_score: 0.45, uncertainty: 0.75, reasons };
    }
    if (!affordance.supported || !consequence.target_placeable) {
      return { decision: 'block', risk_score: 0.88, uncertainty: 0.2, reasons };
    }
    return { decision: 'execute', risk_score: 0.12, uncertainty: 1 - intent.confidence, reasons };
  }
}
