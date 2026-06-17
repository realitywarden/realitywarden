export interface TaskDSL {
  task_id: string;
  intent: string;
  risk_level: 'low' | 'medium' | 'high';
  steps: TaskStep[];
}

export interface TaskStep {
  id: string;
  action:
    | 'scan_area'
    | 'identify_object'
    | 'move_to_pose'
    | 'grasp'
    | 'release'
    | 'return_home'
    | 'throw_object'
    | 'navigate_to'
    | 'dock'
    | 'set_light'
    | 'set_brightness'
    | 'set_color'
    | 'capture_frame'
    | 'read_sensor'
    | 'read_register'
    | 'write_register'
    | 'start_sequence'
    | 'stop_sequence'
    | 'read_measurement'
    | 'set_parameter'
    | 'start_test'
    | 'stop_test'
    | 'scan_slot'
    | 'reserve_slot'
    | 'release_slot'
    | 'mark_item'
    | 'calibrate_sensor'
    | 'reset_sensor'
    | 'start_belt'
    | 'stop_belt'
    | 'sort_item';
  target?: string;
  speed?: 'slow' | 'normal' | 'fast';
  force?: 'low' | 'medium' | 'high';
  value?: string | number | boolean;
  zone?: string;
  note?: string;
}
