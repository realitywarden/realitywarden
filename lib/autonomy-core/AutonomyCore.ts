import { createAdapterCommands } from '@/lib/adapter/AdapterCommandCompiler';
import type { DeviceProfile } from '@/types/deviceMeta';
import type { TaskDSL } from '@/types/taskDsl';
import { AffordanceModel } from './AffordanceModel';
import { AutonomyController } from './AutonomyController';
import type { AutonomyContext } from './AutonomyLevel';
import type { AutonomyResult } from './AutonomyResult';
import { ConsequenceSimulator } from './ConsequenceSimulator';
import { Planner } from './Planner';
import { RiskJudge } from './RiskJudge';
import { SemanticCore } from './SemanticCore';
import type { SemanticIntent } from './SemanticIntent';
import type { GroundingResult, WorldModel } from './WorldModel';
import { WorldModelBuilder } from './WorldModelBuilder';

function ground(intent: SemanticIntent, world: WorldModel): GroundingResult {
  const errors: GroundingResult['errors'] = [];
  const cubes = world.objects.filter((object) => object.type === 'cube');
  const object_id = intent.object_query === 'red cube'
    ? 'red_cube'
    : intent.object_query === 'blue cube'
      ? 'blue_cube'
      : intent.object_query === 'cube'
        ? cubes.length === 1 ? cubes[0].id : undefined
        : undefined;
  if (intent.object_query === 'cube' && cubes.length > 1) errors.push('ambiguous_object');
  if (intent.object_query && !object_id && !errors.includes('ambiguous_object')) errors.push('unknown_object');

  const targetMap: Record<string, string> = {
    'back area': 'back_area',
    'front area': 'front_area',
    'left area': 'left_area',
    'right area': 'right_area',
    'glass cup area': 'glass_cup_neighborhood',
    'outside table': 'outside_table'
  };
  const target_region_id = intent.target_query ? targetMap[intent.target_query] : undefined;
  if (intent.target_query && (!target_region_id || !world.spatial_regions[target_region_id])) errors.push('unknown_target');
  return { object_id, target_region_id, errors };
}

function taskFromPlan(prompt: string, plan: NonNullable<AutonomyResult['selected_plan']>): TaskDSL {
  return {
    task_id: `task-autonomy-${Date.now()}`,
    intent: prompt,
    risk_level: 'low',
    steps: plan.steps
  };
}

export class AutonomyCore {
  private readonly semantic = new SemanticCore();
  private readonly worldBuilder = new WorldModelBuilder();
  private readonly affordances = new AffordanceModel();
  private readonly planner = new Planner();
  private readonly simulator = new ConsequenceSimulator();
  private readonly riskJudge = new RiskJudge();
  private readonly controller = new AutonomyController();

  run(prompt: string, context: AutonomyContext & {
    profile: DeviceProfile;
    device_state?: Record<string, unknown>;
    /**
     * Optional pre-parsed intent (e.g. bridged from a validated LLM proposal).
     * Replaces ONLY the keyword SemanticCore parse; grounding, affordance,
     * planning, consequence simulation, RiskJudge and the AutonomyController
     * all run unchanged on it.
     */
    semantic_intent_override?: SemanticIntent;
  }): AutonomyResult {
    const semanticIntent = context.semantic_intent_override ?? this.semantic.parse(prompt);
    const world = this.worldBuilder.fromRobotArm(context.profile.deviceMeta, context.profile.geometry, context.device_state);
    const groundingResult = ground(semanticIntent, world);
    const affordanceResult = this.affordances.evaluate(semanticIntent, world, groundingResult);
    const planCandidates = this.planner.plan(semanticIntent, groundingResult, affordanceResult);
    const selectedPlan = planCandidates[0];
    const consequenceResult = this.simulator.simulate(world, selectedPlan, groundingResult);
    const riskResult = this.riskJudge.judge(semanticIntent, groundingResult, affordanceResult, consequenceResult);
    const controlled = this.controller.decide(riskResult, selectedPlan, context);

    if (controlled.status !== 'execute') {
      return {
        status: controlled.status,
        semantic_intent: semanticIntent,
        grounding_result: groundingResult,
        world_model_snapshot: world,
        affordance_result: affordanceResult,
        plan_candidates: planCandidates,
        selected_plan: selectedPlan,
        consequence_result: consequenceResult,
        risk_result: riskResult,
        autonomy_level: controlled.autonomy_level,
        adapter_commands: []
      };
    }

    const taskDsl = taskFromPlan(prompt, selectedPlan);
    return {
      status: 'execute',
      semantic_intent: semanticIntent,
      grounding_result: groundingResult,
      world_model_snapshot: world,
      affordance_result: affordanceResult,
      plan_candidates: planCandidates,
      selected_plan: selectedPlan,
      consequence_result: consequenceResult,
      risk_result: riskResult,
      autonomy_level: controlled.autonomy_level,
      task_dsl: taskDsl,
      adapter_commands: createAdapterCommands(context.profile.deviceMeta, taskDsl)
    };
  }
}
