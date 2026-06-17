export const safetyRules = {
  profile_id: 'desktop-pick-place-arm',
  disallowActions: ['throw_object'],
  disallowTargets: ['outside_table'],
  disallowZones: ['glass_cup_zone'],
  maxAllowedSpeed: 'slow',
  normalSpeed: 'warning',
  fastSpeed: 'blocked',
  maxAllowedForce: 'low',
  mediumForce: 'blocked',
  highForce: 'blocked',
  highRisk: 'blocked'
};
