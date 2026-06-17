import type { GroundingResult, WorldModel } from './WorldModel';
import type { SemanticIntent } from './SemanticIntent';

export interface AffordanceResult {
  supported: boolean;
  reasons: string[];
  device_can: string[];
  device_cannot: string[];
  object_affordances: string[];
}

export class AffordanceModel {
  evaluate(intent: SemanticIntent, world: WorldModel, grounding: GroundingResult): AffordanceResult {
    const object = grounding.object_id ? world.objects.find((item) => item.id === grounding.object_id) : undefined;
    const reasons: string[] = [];
    if (intent.goal === 'throw_object') reasons.push('throw_object is not supported by robot_arm.');
    if (object && !object.movable) reasons.push(`${object.id} is not movable.`);
    if (object?.fragile) reasons.push(`${object.id} is fragile and should avoid contact.`);
    if (grounding.target_region_id === 'outside_table') reasons.push('move_outside_workspace is not supported.');

    return {
      supported: reasons.length === 0,
      reasons,
      device_can: ['identify_object', 'move_to_pose', 'grasp', 'release', 'return_home'],
      device_cannot: ['throw_object', 'crush_object', 'move_outside_workspace'],
      object_affordances: object
        ? object.fragile
          ? ['fragile', 'avoid_contact']
          : ['graspable', 'movable']
        : []
    };
  }
}
