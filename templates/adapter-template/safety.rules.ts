export const safetyRules = {
  disallowActions: ['throw_object'],
  disallowTargets: ['outside_table'],
  disallowZones: ['glass_cup_zone'],
  maxAllowedSpeed: 'normal',
  maxAllowedForce: 'medium',
  requireKnownTargets: true,
  requireCapabilityMatch: true,
  requireExecutionLogging: true
};

export function assertSafetyRulesPresent() {
  const requiredKeys = [
    'disallowActions',
    'disallowTargets',
    'disallowZones',
    'maxAllowedSpeed',
    'maxAllowedForce',
    'requireKnownTargets',
    'requireCapabilityMatch',
    'requireExecutionLogging'
  ];

  for (const key of requiredKeys) {
    if (!(key in safetyRules)) {
      throw new Error(`Missing safety rule: ${key}`);
    }
  }
}
