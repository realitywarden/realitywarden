export type SemanticGoal =
  | 'move_object'
  | 'return_home'
  | 'inspect'
  | 'throw_object'
  | 'organize_workspace';

export interface SemanticIntent {
  goal: SemanticGoal;
  object_query: 'red cube' | 'blue cube' | 'cube' | null;
  target_query:
    | 'back area'
    | 'front area'
    | 'left area'
    | 'right area'
    | 'glass cup area'
    | 'outside table'
    | null;
  confidence: number;
  raw_prompt: string;
}
