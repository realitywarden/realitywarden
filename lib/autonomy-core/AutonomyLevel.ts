export type AutonomyLevel =
  | 'L0_manual'
  | 'L1_scripted'
  | 'L2_goal_based'
  | 'L3_supervised_agent'
  | 'L4_bounded_autonomous'
  | 'L5_free_sandbox';

export interface AutonomyContext {
  autonomy_level?: AutonomyLevel;
  mode?: 'simulation' | 'live';
}
