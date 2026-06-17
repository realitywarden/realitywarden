import { z } from 'zod';

export const ExecutionStepReportSchema = z.object({
  step_id: z.string(),
  action: z.string(),
  target: z.string().optional(),
  status: z.enum(['pending', 'running', 'completed', 'blocked', 'failed']),
  reason: z.string().optional()
});

export const ExecutionReportSchema = z.object({
  execution_id: z.string(),
  task_id: z.string(),
  status: z.enum(['idle', 'blocked', 'executing', 'completed', 'failed']),
  profile_id: z.string().optional(),
  dry_run: z.object({
    dry_run_status: z.enum(['pass', 'blocked']),
    checked_profile: z.string(),
    checked_workspace: z.boolean(),
    checked_forbidden_zones: z.boolean(),
    checked_path: z.boolean()
  }),
  dry_run_report: z.object({
    dry_run_status: z.enum(['pass', 'blocked', 'needs_confirmation']),
    profile_id: z.string(),
    motion_steps_checked: z.number(),
    reachability_pass: z.boolean(),
    collision_pass: z.boolean(),
    forbidden_zone_pass: z.boolean(),
    blocked_reasons: z.array(z.string()),
    planned_path: z.array(z.tuple([z.number(), z.number(), z.number()]))
  }).optional(),
  motion_plan: z.object({
    plan_id: z.string(),
    task_id: z.string(),
    profile_id: z.string(),
    steps: z.array(z.object({
      step_id: z.string(),
      action: z.string(),
      target: z.string().optional(),
      target_position: z.tuple([z.number(), z.number(), z.number()]).optional(),
      path: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
      speed: z.string().optional(),
      force: z.string().optional(),
      estimated_duration_ms: z.number(),
      status: z.string(),
      note: z.string().optional()
    })),
    adapter_commands: z.array(z.object({
      command: z.string(),
      target_position: z.tuple([z.number(), z.number(), z.number()]).optional(),
      speed: z.string().optional(),
      force: z.string().optional(),
      source_step_id: z.string()
    }))
  }).optional(),
  adapter_commands: z.array(z.object({
    command: z.string(),
    target_position: z.tuple([z.number(), z.number(), z.number()]).optional(),
    speed: z.string().optional(),
    force: z.string().optional(),
    source_step_id: z.string()
  })).optional(),
  timeline: z.array(z.object({
    id: z.string(),
    timestamp_ms: z.number(),
    type: z.string(),
    step_id: z.string().optional(),
    message: z.string()
  })).optional(),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  steps: z.array(ExecutionStepReportSchema),
  summary: z.string()
});
