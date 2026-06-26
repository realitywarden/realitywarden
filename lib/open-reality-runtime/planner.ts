import type { Goal, RuntimePlan, DeviceManifest } from './types';

function capabilityIdsForGoal(goal: Goal): string[] {
  switch (goal.goalType) {
    case 'pick_and_place':
    case 'precision_place':
      return ['detect_object', 'move_to_pose', 'grasp', 'release', 'return_home'];
    case 'capture_image':
      return ['capture_image'];
    case 'scan_area':
      return ['scan', 'read_sensor'];
    case 'read_state':
    case 'inspect':
      return ['read_sensor'];
    case 'turn_on':
      return ['turn_on'];
    case 'turn_off':
      return ['turn_off'];
    case 'set_color':
      return ['set_color'];
    case 'set_brightness':
      return ['set_brightness'];
    case 'return_home':
      return ['return_home'];
    case 'stop':
      return ['stop'];
    case 'throw_object':
    case 'smash_object':
    case 'move_outside_workspace':
    case 'destructive_action':
    case 'unsafe_speed':
      return ['move_to_pose', 'grasp'];
    default:
      return [];
  }
}

export function buildPlan(goal: Goal, manifest: DeviceManifest): RuntimePlan {
  const requiredCapabilities = capabilityIdsForGoal(goal);
  const capabilitySet = new Set(manifest.capabilities.map((capability) => capability.id));
  const missingCapabilities = requiredCapabilities.filter((capabilityId) => !capabilitySet.has(capabilityId));
  const steps: RuntimePlan['steps'] = [];

  if (missingCapabilities.length === 0) {
    switch (goal.goalType) {
      case 'pick_and_place':
      case 'precision_place':
        steps.push(
          { stepId: 'step-1', capabilityId: 'detect_object', action: 'identify_object', target: goal.objectRef, speed: 'slow' },
          { stepId: 'step-2', capabilityId: 'move_to_pose', action: 'move_to_pose', target: goal.objectRef, speed: goal.precisionRequirement === 'high' ? 'slow' : 'normal' },
          { stepId: 'step-3', capabilityId: 'grasp', action: 'grasp', target: goal.objectRef, force: 'medium' },
          { stepId: 'step-4', capabilityId: 'move_to_pose', action: 'move_to_pose', target: goal.targetZone, speed: goal.precisionRequirement === 'high' ? 'slow' : 'normal' },
          { stepId: 'step-5', capabilityId: 'release', action: 'release', target: goal.objectRef, zone: goal.targetZone, force: 'low' },
          { stepId: 'step-6', capabilityId: 'return_home', action: 'return_home', speed: 'slow' }
        );
        break;
      case 'capture_image':
        steps.push({ stepId: 'step-1', capabilityId: 'capture_image', action: 'capture_frame', target: 'camera_view', speed: 'slow' });
        break;
      case 'scan_area':
        steps.push(
          { stepId: 'step-1', capabilityId: 'scan', action: 'read_sensor', target: goal.targetZone ?? 'current_area', speed: 'slow' },
          { stepId: 'step-2', capabilityId: 'capture_image', action: 'capture_frame', target: goal.targetZone ?? 'current_area', speed: 'slow' }
        );
        break;
      case 'read_state':
      case 'inspect':
        steps.push({ stepId: 'step-1', capabilityId: 'read_sensor', action: 'read_sensor', target: 'camera_view', speed: 'slow' });
        break;
      case 'turn_on':
        steps.push({ stepId: 'step-1', capabilityId: 'turn_on', action: 'set_light', target: 'lamp', value: true, speed: 'slow' });
        break;
      case 'turn_off':
        steps.push(
          { stepId: 'step-1', capabilityId: 'set_brightness', action: 'set_brightness', target: 'lamp', value: 0, speed: 'slow' },
          { stepId: 'step-2', capabilityId: 'turn_off', action: 'set_light', target: 'lamp', value: false, speed: 'slow' }
        );
        break;
      case 'set_color':
        steps.push(
          { stepId: 'step-1', capabilityId: 'turn_on', action: 'set_light', target: 'lamp', value: true, speed: 'slow' },
          { stepId: 'step-2', capabilityId: 'set_color', action: 'set_color', target: 'lamp', value: goal.desiredState?.color ?? 'blue', speed: 'slow' }
        );
        break;
      case 'set_brightness':
        steps.push(
          { stepId: 'step-1', capabilityId: 'turn_on', action: 'set_light', target: 'lamp', value: true, speed: 'slow' },
          { stepId: 'step-2', capabilityId: 'set_brightness', action: 'set_brightness', target: 'lamp', value: goal.desiredState?.brightness ?? 45, speed: 'slow' }
        );
        break;
      case 'return_home':
        steps.push({ stepId: 'step-1', capabilityId: 'return_home', action: 'return_home', speed: 'slow' });
        break;
      case 'stop':
        steps.push({ stepId: 'step-1', capabilityId: 'stop', action: 'return_home', speed: 'slow', note: 'Stop requested. Returning to safe state.' });
        break;
      default:
        break;
    }
  }

  return {
    requiredCapabilities,
    missingCapabilities,
    steps,
    confidence: goal.precisionRequirement === 'high' ? 0.82 : 0.92,
    reason: missingCapabilities.length > 0 ? 'missing_capability' : goal.goalType
  };
}
