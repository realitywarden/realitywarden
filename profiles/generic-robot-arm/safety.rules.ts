export const safetyRules = {
  profile_id: 'generic-robot-arm',
  disallowActions: ['throw_object'],
  disallowTargets: ['outside_table'],
  disallowZones: ['glass_cup_zone'],
  maxAllowedSpeed: 'normal',
  maxAllowedForce: 'medium',
  mediumRisk: 'allow_with_warning',
  highRisk: 'blocked'
};
