import type { AffordanceResult } from './AffordanceModel';
import type { ConsequenceResult } from './ConsequenceSimulator';
import type { SemanticIntent } from './SemanticIntent';
import type { GroundingResult } from './WorldModel';

/**
 * HONESTY NOTE: this judge is a deterministic RULE TABLE, not a probabilistic
 * risk model. It used to report pseudo-probabilities (risk_score 0.82 etc.)
 * that were hard-coded constants; those numbers were removed on purpose.
 * `triggered_rules` names exactly which rules fired, and `decision` is the
 * rule outcome. If a real risk model is added later, it must be a separate,
 * clearly-labeled component — do not dress rules up as probabilities again.
 */
export interface RiskResult {
  rule_based: true;
  decision: 'execute' | 'ask_human' | 'simulate_only' | 'block';
  triggered_rules: string[];
  reasons: string[];
}

export class RiskJudge {
  judge(intent: SemanticIntent, grounding: GroundingResult, affordance: AffordanceResult, consequence: ConsequenceResult): RiskResult {
    const reasons = [...grounding.errors, ...affordance.reasons, ...consequence.reasons].map(String);
    const triggered_rules: string[] = [];

    if (intent.goal === 'throw_object') {
      reasons.push('throw_object is a hard boundary.');
      triggered_rules.push('hard_boundary:throw_object');
    }
    if (grounding.target_region_id === 'outside_table') {
      reasons.push('outside_table is a hard boundary.');
      triggered_rules.push('hard_boundary:outside_table');
    }
    if (intent.goal === 'throw_object' || grounding.target_region_id === 'outside_table' || affordance.reasons.some((reason) => reason.includes('throw_object'))) {
      return { rule_based: true, decision: 'block', triggered_rules, reasons };
    }
    if (consequence.fragile_contact_risk) {
      triggered_rules.push('fragile_neighborhood:glass_cup_neighborhood');
      return {
        rule_based: true,
        decision: 'ask_human',
        triggered_rules,
        reasons: [...reasons, 'glass_cup_neighborhood requires human confirmation by rule.']
      };
    }
    if (grounding.errors.includes('ambiguous_object') || grounding.errors.includes('unknown_object') || grounding.errors.includes('unknown_target')) {
      triggered_rules.push('grounding_incomplete');
      return { rule_based: true, decision: 'ask_human', triggered_rules, reasons };
    }
    if (!affordance.supported || !consequence.target_placeable) {
      triggered_rules.push('unsupported_or_unplaceable');
      return { rule_based: true, decision: 'block', triggered_rules, reasons };
    }
    triggered_rules.push('no_blocking_rule_fired');
    return { rule_based: true, decision: 'execute', triggered_rules, reasons };
  }
}
