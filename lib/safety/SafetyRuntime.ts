import type { DeviceMeta } from '@/types/deviceMeta';
import type { SafetyCheck, SafetyReport } from '@/types/safety';
import type { TaskDSL } from '@/types/taskDsl';

const defaultKnownTargets = [
  'table_area',
  'red_cube',
  'blue_cube',
  'glass_cup',
  'left_safe_zone',
  'right_safe_zone',
  'front_safe_zone',
  'back_safe_zone',
  'outside_table',
  'pickup_zone',
  'home',
  'charging_dock',
  'aisle_a',
  'restricted_zone',
  'lamp',
  'office',
  'operator_station',
  'camera_view',
  'privacy_zone',
  'belt',
  'bin_a',
  'jam_zone'
  ,
  'register_bank',
  'safe_sequence',
  'test_channel',
  'measurement_port',
  'rack_slot_a1',
  'sensor_probe',
  'safe_zone',
  'inspection_zone',
  'unsafe_zone'
];

const failureReasonByCheck: Record<string, string> = {
  action_supported: 'Action is not listed in device capabilities.',
  target_exists: 'Target does not exist in the device scene.',
  inside_workspace: 'Target is outside the table workspace.',
  no_forbidden_zone_violation: 'Task enters glass_cup_zone.',
  speed_limit_safe: 'speed=fast is not allowed.',
  force_limit_safe: 'force=high is not allowed.',
  no_throwing_action: 'throw_object is not allowed.',
  logging_enabled: 'Device logging is required but disabled.',
  risk_level_acceptable: 'risk_level=high must be blocked.'
};

const rank = {
  slow: 1,
  normal: 2,
  fast: 3,
  low: 1,
  medium: 2,
  high: 3
};

function makeCheck(id: string, label: string, status: SafetyCheck['status'], reason?: string): SafetyCheck {
  return {
    id,
    label,
    status,
    reason: status === 'pass' ? undefined : reason ?? failureReasonByCheck[id]
  };
}

export function runSafetyRuntime(deviceMeta: DeviceMeta, task: TaskDSL): SafetyReport {
  const knownTargets = new Set(deviceMeta.constraints.known_targets ?? defaultKnownTargets);
  const actionsSupported = task.steps.every(
    (step) => step.action !== 'throw_object' && deviceMeta.capabilities.includes(step.action)
  );
  const targetsExist = task.steps.every((step) => !step.target || knownTargets.has(step.target));
  const insideWorkspace =
    task.steps.every((step) => step.target !== 'outside_table') || deviceMeta.safety_profile.allow_outside_workspace;
  const avoidsForbiddenZones = task.steps.every(
    (step) =>
      !deviceMeta.constraints.forbidden_zones.includes(step.target ?? '') &&
      !deviceMeta.constraints.forbidden_zones.includes(step.zone ?? '')
  );
  const hasFastSpeed = task.steps.some((step) => step.speed === 'fast');
  const hasSpeedOverLimit = task.steps.some((step) => step.speed && rank[step.speed] > rank[deviceMeta.constraints.max_speed]);
  const hasNormalSpeedWarning = deviceMeta.profile_id === 'desktop-pick-place-arm' && task.steps.some((step) => step.speed === 'normal');
  const hasForceOverLimit = task.steps.some((step) => step.force && rank[step.force] > rank[deviceMeta.constraints.force_limit]);
  const noThrowing = task.steps.every((step) => step.action !== 'throw_object') || deviceMeta.safety_profile.allow_throwing;
  const loggingEnabled = deviceMeta.safety_profile.require_logging;
  const riskStatus: SafetyCheck['status'] =
    task.risk_level === 'high'
      ? 'fail'
      : task.risk_level === 'medium' && deviceMeta.safety_profile.block_medium_risk
        ? 'fail'
        : task.risk_level === 'medium' && deviceMeta.safety_profile.medium_risk_requires_confirmation
          ? 'warning'
          : 'pass';

  const checks = [
    makeCheck('action_supported', 'All actions are in device capabilities', actionsSupported ? 'pass' : 'fail'),
    makeCheck('target_exists', 'All targets exist', targetsExist ? 'pass' : 'fail'),
    makeCheck('inside_workspace', 'Targets stay inside table workspace', insideWorkspace ? 'pass' : 'fail'),
    makeCheck('no_forbidden_zone_violation', 'Route avoids configured forbidden zones', avoidsForbiddenZones ? 'pass' : 'fail'),
    makeCheck(
      'speed_limit_safe',
      `Speed is within profile limit (${deviceMeta.constraints.max_speed})`,
      hasFastSpeed || hasSpeedOverLimit ? 'fail' : hasNormalSpeedWarning ? 'warning' : 'pass',
      hasFastSpeed ? 'speed=fast is not allowed.' : hasSpeedOverLimit ? `Speed exceeds profile limit: ${deviceMeta.constraints.max_speed}.` : 'speed=normal is warning-only for this desktop profile.'
    ),
    makeCheck(
      'force_limit_safe',
      `Force is within profile limit (${deviceMeta.constraints.force_limit})`,
      hasForceOverLimit ? 'fail' : 'pass',
      `Force exceeds profile limit: ${deviceMeta.constraints.force_limit}.`
    ),
    makeCheck('no_throwing_action', 'No throw_object action', noThrowing ? 'pass' : 'fail'),
    makeCheck('logging_enabled', 'Execution logging is enabled', loggingEnabled ? 'pass' : 'fail'),
    makeCheck('risk_level_acceptable', 'Risk level is acceptable for current profile', riskStatus, riskStatus === 'warning' ? 'risk_level=medium needs confirmation for this profile.' : failureReasonByCheck.risk_level_acceptable)
  ];

  const blocked_reasons = checks
    .filter((check) => check.status === 'fail')
    .map((check) => check.reason ?? check.label);
  const status = blocked_reasons.length > 0 ? 'blocked' : checks.some((check) => check.status === 'warning') ? 'needs_confirmation' : 'pass';
  const score = Math.max(0, Math.round((checks.filter((check) => check.status === 'pass').length / checks.length) * 100));

  return {
    status,
    score,
    checks,
    blocked_reasons,
    summary:
      status === 'pass'
        ? 'Safety Runtime passed. The task can be executed by the simulator.'
        : status === 'needs_confirmation'
          ? 'Safety Runtime requires human confirmation for this device profile.'
        : 'Safety Runtime blocked the task before device execution.'
  };
}
