export type AdapterAction =
  | 'scan_area'
  | 'identify_object'
  | 'move_to_pose'
  | 'grasp'
  | 'release'
  | 'return_home';

export interface AdapterActionInput {
  action: AdapterAction;
  target?: string;
  speed?: 'slow' | 'normal';
  force?: 'low' | 'medium';
  zone?: string;
}

export const supportedActions: AdapterAction[] = [
  'scan_area',
  'identify_object',
  'move_to_pose',
  'grasp',
  'release',
  'return_home'
];

export async function executeAction(input: AdapterActionInput) {
  if (!supportedActions.includes(input.action)) {
    throw new Error(`Unsupported adapter action: ${input.action}`);
  }

  return {
    action: input.action,
    target: input.target,
    status: 'completed' as const
  };
}
