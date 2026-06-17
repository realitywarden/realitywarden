export const safetyRules = {
  profile_id: 'restricted-lab-arm',
  disallowActions: ['throw_object'],
  disallowTargets: ['outside_table'],
  disallowZones: ['glass_cup_zone', 'operator_zone', 'calibration_zone'],
  maxAllowedSpeed: 'slow',
  maxAllowedForce: 'low',
  mediumRisk: 'needs_confirmation',
  highRisk: 'blocked',
  mediumForce: 'blocked',
  highForce: 'blocked'
};
