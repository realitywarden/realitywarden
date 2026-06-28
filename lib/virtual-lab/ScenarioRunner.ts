import { compilePromptToTaskDSL } from '@/lib/compiler/mockTaskCompiler';
import { DeviceActionRuntime } from '@/lib/action-runtime/DeviceActionRuntime';
import { summarizeActionPlan } from '@/lib/action-runtime/ActionPlan';
import { buildExecutionLabReport } from '@/lib/reporting/buildLabReport';
import type { ActionPlan } from '@/lib/action-runtime/ActionPlan';
import type { ActionFrame } from '@/lib/action-runtime/ActionState';
import { runSafetyRuntime } from '@/lib/safety/SafetyRuntime';
import type { DeviceProfile } from '@/types/deviceMeta';
import type { SafetyReport } from '@/types/safety';
import type { DeviceScenario } from './DeviceScenario';
import type { LabReport, ExecutionTimelineEvent, TimelineStateSnapshot } from './LabReport';
import { SimulatorAdapter } from './SimulatorAdapter';
import { VirtualDeviceInstance } from './VirtualDeviceInstance';

function timeline(stage: ExecutionTimelineEvent['stage'], message: string, index: number): ExecutionTimelineEvent {
  return {
    id: `evt-${index}`,
    timestamp_ms: index * 120,
    stage,
    message
  };
}

function diffKeys(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function snapshot({
  stepIndex,
  stepId,
  commandId,
  stage,
  safetyReport,
  before,
  after,
  message,
  actionFrame
}: {
  stepIndex: number;
  stepId: string;
  commandId?: string;
  stage: TimelineStateSnapshot['stage'];
  safetyReport: SafetyReport;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  message: string;
  actionFrame?: ActionFrame;
}): TimelineStateSnapshot {
  return {
    step_index: stepIndex,
    step_id: stepId,
    command_id: commandId,
    stage,
    safety_status: safetyReport.status,
    safety_report: safetyReport,
    device_state: after,
    action_frame: actionFrame,
    changed_keys: diffKeys(before, after),
    message,
    timestamp_ms: stepIndex * 120
  };
}

export class ScenarioRunner {
  async run(profile: DeviceProfile, scenario: DeviceScenario, promptOverride?: string): Promise<LabReport> {
    const prompt = promptOverride?.trim() || scenario.prompt;
    const instance = new VirtualDeviceInstance(`${profile.id}-${Date.now()}`, profile.deviceMeta, profile.geometry, scenario.initial_state);
    const adapter = new SimulatorAdapter(instance);
    await adapter.connect();

    const deviceStateBefore = await adapter.getState();
    const actionRuntime = new DeviceActionRuntime();
    const taskDsl = compilePromptToTaskDSL(prompt, profile.deviceMeta.device_type);
    const safetyReport = runSafetyRuntime(profile.deviceMeta, taskDsl);
    const adapterCommands = taskDsl.steps.map((step) => adapter.createCommand(step));
    const actionPlans: ActionPlan[] = [];
    const stateSnapshots: TimelineStateSnapshot[] = [
      snapshot({
        stepIndex: 0,
        stepId: 'initial',
        stage: 'initial',
        safetyReport,
        before: deviceStateBefore,
        after: deviceStateBefore,
        message: 'Initial device state captured.'
      })
    ];
    const events: ExecutionTimelineEvent[] = [
      timeline('compile', `Prompt compiled to ${scenario.expected_task_type}.`, 0),
      timeline('safety', `Safety Runtime returned ${safetyReport.status}.`, 1)
    ];

    let result: LabReport['result'] = 'pass';
    if (safetyReport.status === 'blocked') {
      result = 'blocked';
      events.push(timeline('adapter', 'Adapter commands were intercepted before execution.', 2));
      if (adapterCommands[0]) {
        actionPlans.push(actionRuntime.createBlockedActionPlan(
          adapterCommands[0],
          profile.deviceMeta,
          deviceStateBefore,
          safetyReport.blocked_reasons[0] ?? 'Safety Runtime blocked the task before adapter execution.'
        ));
      }
      stateSnapshots.push(snapshot({
        stepIndex: 1,
        stepId: adapterCommands[0]?.source_step_id ?? 'blocked',
        commandId: adapterCommands[0]?.id,
        stage: 'blocked',
        safetyReport,
        before: deviceStateBefore,
        after: deviceStateBefore,
        message: 'Blocked before adapter execution. Device state preserved.'
      }));
    } else {
      for (let index = 0; index < adapterCommands.length; index += 1) {
        const command = adapterCommands[index];
        const before = await adapter.getState();
        const actionPlan = actionRuntime.createActionPlan(command, profile.deviceMeta, profile.geometry, before);
        actionPlans.push(actionPlan);
        const commandResult = await adapter.executeCommand(command);
        const after = await adapter.getState();
        events.push(timeline('adapter', `${command.id}: ${commandResult.message}`, index + 2));
        stateSnapshots.push(snapshot({
          stepIndex: index + 1,
          stepId: command.source_step_id,
          commandId: command.id,
          stage: commandResult.status === 'ok' ? 'device' : commandResult.status === 'blocked' ? 'blocked' : 'adapter',
          safetyReport,
          before,
          after,
          message: `${commandResult.message} ActionPlan ${actionPlan.action_plan_id} generated ${actionPlan.frames.length} frames.`,
          actionFrame: actionPlan.frames[actionPlan.frames.length - 1]
        }));
        if (commandResult.status !== 'ok') result = commandResult.status === 'blocked' ? 'blocked' : 'failed';
      }
      events.push(timeline('device', 'Virtual device state updated through SimulatorAdapter.', adapterCommands.length + 2));
    }

    const deviceStateAfter = result === 'blocked' ? deviceStateBefore : await adapter.getState();
    await adapter.disconnect();

    return buildExecutionLabReport({
      profile,
      scenarioId: scenario.id,
      prompt,
      taskDsl,
      safetyReport,
      adapterCommands,
      actionPlans: actionPlans.map(summarizeActionPlan),
      deviceStateBefore,
      deviceStateAfter,
      executionTimeline: [...events, timeline('report', `Lab run finished with result=${result}.`, events.length + 1)],
      stateSnapshots,
      result
    });
  }
}
