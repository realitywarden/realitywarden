import type { MotionPlan, SimulationRunResult, TimelineEvent, WorldState } from '@/types/simulation';
import { cloneWorldState } from './WorldState';
import { createInitialTimeline, eventForStep } from './ReplayTimeline';
import type { OperationalDryRunReport } from '@/types/simulation';

export function executeMotionPlan(initialWorld: WorldState, motionPlan: MotionPlan, dryRun: OperationalDryRunReport): SimulationRunResult {
  const world = cloneWorldState(initialWorld);
  const timeline: TimelineEvent[] = createInitialTimeline(dryRun, motionPlan);

  if (dryRun.dry_run_status !== 'pass') {
    world.execution_status = 'blocked';
    timeline.push({
      id: `event-${Date.now()}-blocked`,
      timestamp_ms: 1,
      type: 'blocked',
      message: `Execution blocked before simulator movement: ${dryRun.blocked_reasons.join(' ')}`
    });
    return { worldState: world, motionPlan, dryRun, timeline };
  }

  world.execution_status = 'executing';
  let timestamp = 1;

  for (const step of motionPlan.steps) {
    step.status = 'running';
    timeline.push(eventForStep('step_started', step.step_id, `${step.action} started`, timestamp));
    timestamp += step.estimated_duration_ms;

    if (step.action === 'move_to_pose' && step.target_position) {
      world.robot.current_position = step.target_position;
      if (world.gripper.holding_object_id) {
        world.objects[world.gripper.holding_object_id].position = step.target_position;
      }
    }

    if (step.action === 'grasp' && step.target && world.objects[step.target]) {
      world.gripper.status = 'closed';
      world.gripper.holding_object_id = step.target;
    }

    if (step.action === 'release') {
      if (world.gripper.holding_object_id && step.target_position) {
        world.objects[world.gripper.holding_object_id].position = step.target_position;
      }
      world.gripper.status = 'open';
      delete world.gripper.holding_object_id;
    }

    if (step.action === 'return_home') {
      world.robot.current_position = world.robot.home_position;
    }

    step.status = 'completed';
    timeline.push(eventForStep('step_completed', step.step_id, `${step.action} completed`, timestamp));
  }

  world.gripper.status = 'open';
  delete world.gripper.holding_object_id;
  world.robot.current_position = world.robot.home_position;
  world.execution_status = 'completed';
  timeline.push({
    id: `event-${Date.now()}-world-state`,
    timestamp_ms: timestamp + 1,
    type: 'world_state_updated',
    message: 'WorldState updated and robot returned home.'
  });

  return { worldState: world, motionPlan, dryRun, timeline };
}
