import type { MotionPlan, OperationalDryRunReport, TimelineEvent } from '@/types/simulation';

export function createInitialTimeline(dryRun: OperationalDryRunReport, motionPlan: MotionPlan): TimelineEvent[] {
  return [
    {
      id: `event-${Date.now()}-dry-run`,
      timestamp_ms: 0,
      type: 'dry_run',
      message: `Dry run ${dryRun.dry_run_status} for ${dryRun.profile_id}; checked ${motionPlan.steps.length} motion steps.`
    }
  ];
}

export function eventForStep(type: TimelineEvent['type'], stepId: string, message: string, timestamp_ms: number): TimelineEvent {
  return {
    id: `event-${stepId}-${type}-${timestamp_ms}`,
    timestamp_ms,
    type,
    step_id: stepId,
    message
  };
}

export function createBlockedReplayTimeline(dryRun: OperationalDryRunReport): TimelineEvent[] {
  return [
    {
      id: `replay-${Date.now()}`,
      timestamp_ms: 0,
      type: 'replay',
      message: `Replay dry run only: ${dryRun.dry_run_status}. ${dryRun.blocked_reasons.join(' ')}`
    }
  ];
}
