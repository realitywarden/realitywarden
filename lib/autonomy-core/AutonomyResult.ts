import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { TaskDSL } from '@/types/taskDsl';
import type { AffordanceResult } from './AffordanceModel';
import type { ConsequenceResult } from './ConsequenceSimulator';
import type { AutonomyLevel } from './AutonomyLevel';
import type { PlanCandidate } from './Planner';
import type { RiskResult } from './RiskJudge';
import type { SemanticIntent } from './SemanticIntent';
import type { GroundingResult, WorldModel } from './WorldModel';

export interface AutonomyResult {
  status: 'execute' | 'ask_human' | 'simulate_only' | 'block' | 'proposed_plan';
  semantic_intent: SemanticIntent;
  grounding_result: GroundingResult;
  world_model_snapshot: WorldModel;
  affordance_result: AffordanceResult;
  plan_candidates: PlanCandidate[];
  selected_plan?: PlanCandidate;
  consequence_result: ConsequenceResult;
  risk_result: RiskResult;
  autonomy_level: AutonomyLevel;
  task_dsl?: TaskDSL;
  adapter_commands: AdapterCommand[];
}
