import type { TaskDSL } from '@/types/taskDsl';
import type { AdapterCommand, MotionPlan, MotionPlanStep, WorldState } from '@/types/simulation';
import { samplePath, targetToPosition } from './CoordinateSystem';

function durationForSpeed(speed: string | undefined) {
  if (speed === 'slow') return 1000;
  if (speed === 'fast') return 350;
  return 700;
}

function commandForStep(step: MotionPlanStep): AdapterCommand | null {
  if (step.action === 'scan_event') {
    return { command: 'scan_area', source_step_id: step.step_id };
  }
  if (step.action === 'identify_object') {
    return { command: 'identify_object', target_position: step.target_position, source_step_id: step.step_id };
  }
  if (step.action === 'move_to_pose') {
    return { command: 'move_to_pose', target_position: step.target_position, speed: step.speed, source_step_id: step.step_id };
  }
  if (step.action === 'grasp') {
    return { command: 'grasp', target_position: step.target_position, force: step.force, source_step_id: step.step_id };
  }
  if (step.action === 'release') {
    return { command: 'release', target_position: step.target_position, force: step.force, source_step_id: step.step_id };
  }
  if (step.action === 'return_home') {
    return { command: 'return_home', target_position: step.target_position, source_step_id: step.step_id };
  }
  return null;
}

export function buildMotionPlan(task: TaskDSL, world: WorldState): MotionPlan {
  const steps: MotionPlanStep[] = [];
  let cursor = world.robot.current_position;

  for (const step of task.steps) {
    if (step.action === 'throw_object') {
      steps.push({
        step_id: step.id,
        action: step.action,
        target: step.target,
        speed: step.speed,
        force: step.force,
        estimated_duration_ms: 0,
        status: 'blocked',
        note: 'throw_object does not generate an executable plan'
      });
      continue;
    }

    const targetPosition =
      step.action === 'return_home'
        ? world.robot.home_position
        : step.action === 'release' && step.zone
          ? targetToPosition(step.zone, world)
          : targetToPosition(step.target, world);
    const path = step.action === 'move_to_pose' || step.action === 'return_home'
      ? samplePath(cursor, targetPosition ?? cursor)
      : undefined;

    const planStep: MotionPlanStep = {
      step_id: step.id,
      action: step.action === 'scan_area' ? 'scan_event' : step.action,
      target: step.target,
      target_position: targetPosition,
      path,
      speed: step.speed,
      force: step.force,
      estimated_duration_ms: durationForSpeed(step.speed),
      status: 'pending',
      note: step.note
    };

    steps.push(planStep);
    if (targetPosition && (step.action === 'move_to_pose' || step.action === 'return_home')) {
      cursor = targetPosition;
    }
  }

  const adapter_commands = steps.map(commandForStep).filter((command): command is AdapterCommand => Boolean(command));

  return {
    plan_id: `plan-${Date.now()}`,
    task_id: task.task_id,
    profile_id: world.profile_id,
    steps,
    adapter_commands
  };
}
