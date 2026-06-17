import type { TaskStep } from '@/types/taskDsl';
import type { AffordanceResult } from './AffordanceModel';
import type { SemanticIntent } from './SemanticIntent';
import type { GroundingResult } from './WorldModel';

export interface PlanCandidate {
  plan_id: string;
  type: 'pick_and_place' | 'return_home' | 'inspect' | 'proposed_plan' | 'unsupported';
  steps: TaskStep[];
  requires_human_confirmation: boolean;
  summary: string;
}

const regionToTarget: Record<string, string> = {
  front_area: 'front_safe_zone',
  back_area: 'back_safe_zone',
  left_area: 'left_safe_zone',
  right_area: 'right_safe_zone',
  glass_cup_neighborhood: 'glass_cup_zone',
  outside_table: 'outside_table'
};

export class Planner {
  plan(intent: SemanticIntent, grounding: GroundingResult, affordance: AffordanceResult): PlanCandidate[] {
    if (intent.goal === 'organize_workspace') {
      return [{
        plan_id: 'plan-organize-workspace',
        type: 'proposed_plan',
        steps: [],
        requires_human_confirmation: true,
        summary: 'Move loose cubes to safe regions, avoid fragile objects, and return home after each task.'
      }];
    }
    if (intent.goal === 'return_home') {
      return [{
        plan_id: 'plan-return-home',
        type: 'return_home',
        steps: [{ id: 'step-1', action: 'return_home', speed: 'slow' }],
        requires_human_confirmation: false,
        summary: 'Return robot arm to home pose.'
      }];
    }
    if (!affordance.supported || !grounding.object_id || !grounding.target_region_id) {
      return [{
        plan_id: 'plan-unsupported',
        type: 'unsupported',
        steps: [],
        requires_human_confirmation: true,
        summary: 'No executable plan until object and target are grounded and affordances are supported.'
      }];
    }

    const objectId = grounding.object_id;
    const target = regionToTarget[grounding.target_region_id] ?? grounding.target_region_id;
    return [{
      plan_id: `plan-pick-place-${objectId}-${target}`,
      type: 'pick_and_place',
      steps: [
        { id: 'step-1', action: 'identify_object', target: objectId, speed: 'slow' },
        { id: 'step-2', action: 'move_to_pose', target: objectId, speed: 'normal' },
        { id: 'step-3', action: 'grasp', target: objectId, force: 'medium' },
        { id: 'step-4', action: 'move_to_pose', target, speed: 'normal' },
        { id: 'step-5', action: 'release', target: objectId, force: 'low', zone: target },
        { id: 'step-6', action: 'return_home', speed: 'slow' }
      ],
      requires_human_confirmation: false,
      summary: `Pick ${objectId}, place at ${target}, then return home.`
    }];
  }
}
