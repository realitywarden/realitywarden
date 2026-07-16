import type { ActionManifest } from '../action-manifest/ActionManifest';
import type { DeviceMeta } from '../../types/deviceMeta';
import type { TaskDSL } from '../../types/taskDsl';
import type { HardwareCommand } from './types';

export const REAL_SERVO_TEACH_DEVICE_META: DeviceMeta = {
  profile_id: 'real-esp32-sg90-teach-v1',
  profile_version: '1.0.0',
  manufacturer: 'RealityWarden reference kit',
  model: 'ESP32-S3 + SG90 + HC-SR04',
  device_id: 'esp32-servo-rig',
  device_type: 'robot_arm',
  simulator_profile: 'robot_arm_semantic_v1',
  supported_adapters: ['esp32_serial'],
  risk_class: 'medium',
  display_name: 'REAL SG90 teach rig',
  // move_to_angle is a REAL hardware capability, intentionally not added to
  // the simulation-only DeviceCapability union. The manifest validator reads
  // capability strings generically and the hardware gate remains authoritative.
  capabilities: ['move_to_angle'] as unknown as DeviceMeta['capabilities'],
  constraints: {
    workspace: { x_min: 0, x_max: 0, y_min: 0, y_max: 0, z_min: 0, z_max: 0 },
    max_speed: 'slow',
    force_limit: 'low',
    forbidden_zones: [],
    known_targets: []
  },
  safety_profile: {
    allow_throwing: false,
    allow_high_force: false,
    allow_outside_workspace: false,
    require_logging: true,
    require_human_confirmation_for_risky_actions: true
  },
  runtime_state: { status: 'idle', current_position: 'open_loop_unknown' }
};

export const REAL_TEACH_BUILTIN_INTENT_IDS: ReadonlySet<string> = new Set([
  'move_object', 'return_home', 'inspect', 'throw_object', 'organize_workspace'
]);

export interface TeachExecutionEvidence {
  status?: 'executed' | 'failed' | 'blocked';
  signalSent?: boolean;
  signalState?: 'not_sent' | 'attempted_unconfirmed' | 'device_acknowledged';
  executionEvidence?: string;
}

/** A waypoint is recordable only after an honestly acknowledged command. */
export function waypointAfterJog(
  waypoints: readonly number[],
  requestedAngle: number,
  outcome: TeachExecutionEvidence
): number[] {
  if (outcome.status !== 'executed'
    || outcome.signalSent !== true
    || outcome.signalState !== 'device_acknowledged'
    || outcome.executionEvidence !== 'command_acknowledged_open_loop') {
    return [...waypoints];
  }
  return [...waypoints, requestedAngle];
}

export function buildTeachManifest(
  actionId: string,
  displayName: string,
  waypoints: readonly number[]
): unknown {
  return {
    manifest_version: 1,
    action_id: actionId,
    display_name: { zh: displayName, en: displayName },
    device_type: 'robot_arm',
    safety: {
      // Informational only. validateActionManifest/expandManifestToTaskDsl
      // discard this assessment and recompute risk from authoritative rules.
      declared_risk: 'low',
      required_sensors: [],
      envelope: { max_speed: 'slow', max_force: 'low' }
    },
    steps: waypoints.map((angle) => ({ action: 'move_to_angle', value: angle, speed: 'slow', force: 'low' }))
  };
}

export function hardwareCommandsFromTeachTaskDsl(
  taskDsl: TaskDSL,
  idPrefix = 'teach-replay'
): { ok: true; commands: HardwareCommand[] } | { ok: false; detail: string } {
  if (taskDsl.steps.length < 1 || taskDsl.steps.length > 16) {
    return { ok: false, detail: `invalid_sequence_length:${taskDsl.steps.length}` };
  }
  const commands: HardwareCommand[] = [];
  for (let index = 0; index < taskDsl.steps.length; index += 1) {
    const step = taskDsl.steps[index];
    if (String(step.action) !== 'move_to_angle') {
      return { ok: false, detail: `unsupported_teach_primitive:${step.action}` };
    }
    if (typeof step.value !== 'number' || !Number.isFinite(step.value)) {
      return { ok: false, detail: `invalid_teach_angle_at_step:${index}` };
    }
    commands.push({
      id: `${idPrefix}-${index + 1}`,
      deviceId: 'esp32-servo-rig',
      capabilityId: 'move_to_angle',
      args: { angle: step.value }
    });
  }
  return { ok: true, commands };
}

export type TeachActionManifest = ActionManifest;
