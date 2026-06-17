import { z } from 'zod';

export const TaskStepSchema = z.object({
  id: z.string().min(1),
  action: z.enum([
    'scan_area',
    'identify_object',
    'move_to_pose',
    'grasp',
    'release',
    'return_home',
    'throw_object',
    'navigate_to',
    'dock',
    'set_light',
    'set_brightness',
    'set_color',
    'capture_frame',
    'read_sensor',
    'read_register',
    'write_register',
    'start_sequence',
    'stop_sequence',
    'read_measurement',
    'set_parameter',
    'start_test',
    'stop_test',
    'scan_slot',
    'reserve_slot',
    'release_slot',
    'mark_item',
    'calibrate_sensor',
    'reset_sensor',
    'start_belt',
    'stop_belt',
    'sort_item'
  ]),
  target: z.string().optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
  force: z.enum(['low', 'medium', 'high']).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  zone: z.string().optional(),
  note: z.string().optional()
});

export const TaskDSLSchema = z.object({
  task_id: z.string().min(1),
  intent: z.string().min(1),
  risk_level: z.enum(['low', 'medium', 'high']),
  steps: z.array(TaskStepSchema).min(1)
});
