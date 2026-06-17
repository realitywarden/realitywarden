import type { AdapterCommand } from '@/lib/adapter/AdapterCommand';
import type { DeviceGeometry, DeviceMeta } from '@/types/deviceMeta';
import type { LabReport } from '@/lib/virtual-lab/LabReport';
import type { ActionFrame } from './ActionState';
import { DeviceActionRuntime } from './DeviceActionRuntime';
import { buildRobotArmActionPlan } from './buildRobotArmActionPlan';

export interface PlaybackEvent {
  event_id: string;
  command_id: string;
  frame: ActionFrame;
  timeline_ms: number;
  status?: 'running' | 'completed' | 'blocked';
  message?: string;
}

export class PlaybackEngine {
  constructor(private readonly runtime = new DeviceActionRuntime()) {}

  createEvents(report: LabReport, deviceMeta: DeviceMeta, geometry: DeviceGeometry): PlaybackEvent[] {
    let currentState = report.device_state_before;
    let cursor = 0;
    const events: PlaybackEvent[] = [];

    report.adapter_commands.forEach((command: AdapterCommand) => {
      const plan = deviceMeta.device_type === 'robot_arm' && command.action === 'move_to_pose'
        ? buildRobotArmActionPlan({ command, deviceMeta, geometry, stateBefore: currentState })
        : this.runtime.createActionPlan(command, deviceMeta, geometry, currentState);
      if (plan.validation.blocked || command.allowed === false) {
        events.push({
          event_id: `${plan.action_plan_id}-blocked`,
          command_id: command.id,
          frame: {
            time_ms: 0,
            progress: 0,
            device_state: currentState,
            visual_state: {
              target_position: command.target,
              path_points: []
            },
            command_id: command.id,
            status: 'blocked'
          },
          timeline_ms: cursor,
          status: 'blocked',
          message: plan.validation.reason ?? command.blocked_reason ?? 'Blocked before adapter dispatch.'
        });
        return;
      }
      if (plan.frames.length === 0) return;

      plan.frames.forEach((frame) => {
        events.push({
          event_id: `${plan.action_plan_id}-${frame.time_ms}`,
          command_id: command.id,
          frame,
          timeline_ms: cursor + frame.time_ms,
          status: frame.status === 'completed' ? 'completed' : 'running'
        });
      });
      currentState = plan.end_state;
      cursor += plan.duration_ms;
    });

    return events;
  }
}
