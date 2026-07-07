import type { PlanCandidate } from './Planner';
import type { GroundingResult, WorldModel } from './WorldModel';

/**
 * HONESTY NOTE: this simulator is a deterministic RULE ENGINE, not a
 * probabilistic model. Every field below is a boolean rule outcome — "did
 * this rule fire" — never a probability estimate. Do not present these
 * values as model confidence anywhere in the UI or docs.
 */
export interface ConsequenceResult {
  rule_based: true;
  reachable: boolean;
  collision_risk: boolean;
  fragile_contact_risk: boolean;
  outside_workspace_risk: boolean;
  target_placeable: boolean;
  predicted_state: Record<string, unknown>;
  reasons: string[];
}

function inBounds(position: [number, number, number], world: WorldModel) {
  const bounds = world.workspace_bounds;
  return position[0] >= bounds.x_min && position[0] <= bounds.x_max
    && position[1] >= bounds.y_min && position[1] <= bounds.y_max
    && position[2] >= bounds.z_min && position[2] <= bounds.z_max;
}

export class ConsequenceSimulator {
  simulate(world: WorldModel, plan: PlanCandidate | undefined, grounding: GroundingResult): ConsequenceResult {
    const region = grounding.target_region_id ? world.spatial_regions[grounding.target_region_id] : undefined;
    const object = grounding.object_id ? world.objects.find((item) => item.id === grounding.object_id) : undefined;
    const reasons: string[] = [];
    if (!plan || plan.type === 'unsupported') reasons.push('No executable plan candidate.');
    if (!object && grounding.errors.includes('unknown_object')) reasons.push('Unknown object.');
    if (!region && grounding.errors.includes('unknown_target')) reasons.push('Unknown target.');
    const outside = Boolean(region?.outside_workspace) || Boolean(region && !inBounds(region.position, world));
    const fragile = Boolean(region?.near_fragile_object);
    if (outside) reasons.push('Target is outside workspace.');
    if (fragile) reasons.push('Target is near fragile glass cup.');
    if (object && !object.movable) reasons.push('Object is not movable.');

    return {
      rule_based: true,
      reachable: Boolean(region) && !outside,
      collision_risk: fragile,
      fragile_contact_risk: fragile,
      outside_workspace_risk: outside,
      target_placeable: Boolean(region) && !outside && !fragile,
      predicted_state: object && region ? { [object.id]: { position: region.position } } : {},
      reasons
    };
  }
}
