import type { DeviceMeta } from '@/types/deviceMeta';

export interface ProtocolSafetyProfile {
  profile_version: 'safety-profile.v1';
  allow_throwing: boolean;
  allow_high_force: boolean;
  allow_outside_workspace: boolean;
  require_logging: boolean;
  require_human_confirmation_for_risky_actions: boolean;
  workspace_bounds: DeviceMeta['constraints']['workspace'];
  forbidden_zones: string[];
  speed_limit: DeviceMeta['constraints']['max_speed'];
  force_limit: DeviceMeta['constraints']['force_limit'];
}

export function buildProtocolSafetyProfile(deviceMeta: DeviceMeta): ProtocolSafetyProfile {
  return {
    profile_version: 'safety-profile.v1',
    allow_throwing: deviceMeta.safety_profile.allow_throwing,
    allow_high_force: deviceMeta.safety_profile.allow_high_force,
    allow_outside_workspace: deviceMeta.safety_profile.allow_outside_workspace,
    require_logging: deviceMeta.safety_profile.require_logging,
    require_human_confirmation_for_risky_actions: deviceMeta.safety_profile.require_human_confirmation_for_risky_actions,
    workspace_bounds: deviceMeta.constraints.workspace,
    forbidden_zones: deviceMeta.constraints.forbidden_zones,
    speed_limit: deviceMeta.constraints.max_speed,
    force_limit: deviceMeta.constraints.force_limit
  };
}
