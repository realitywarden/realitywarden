import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { planWorkspacePath, samplePath } from '../CollisionPathPlanner';
import { makePlan, targetPosition, speedDuration } from './modelUtils';

export class MobileRobotActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const start = (currentState.position as [number, number, number]) ?? targetPosition(String(currentState.location ?? 'charging_dock'), geometry);
    if (command.action === 'scan_area') {
      const endState = { ...currentState, status: 'scanned', scanned_area: command.target, position: start };
      return makePlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState,
        durationMs: speedDuration(command.payload.speed, 900),
        visual: (progress) => ({
          position: start,
          heading: Number(currentState.heading ?? 0) + progress * Math.PI * 2,
          scan_progress: progress,
          scan_area: command.target
        })
      });
    }
    const end = targetPosition(command.target, geometry);
    const plannedPath = planWorkspacePath(start, end, geometry);
    const distance = plannedPath.distance;
    const heading = Math.atan2(end[0] - start[0], end[2] - start[2]);
    const endState = { ...currentState, status: command.action === 'dock' ? 'docked' : 'navigated', location: command.target, position: end, heading };
    return makePlan({
      command,
      deviceMeta,
      geometry,
      currentState,
      endState,
      durationMs: speedDuration(command.payload.speed, Math.max(900, distance * 1400)),
      visual: (progress) => {
        const position = samplePath(plannedPath.waypoints, progress);
        const nextPosition = samplePath(plannedPath.waypoints, Math.min(1, progress + 0.04));
        return {
          position,
          heading: Math.atan2(nextPosition[0] - position[0], nextPosition[2] - position[2]),
          path: plannedPath.waypoints,
          collision_risk: plannedPath.collision_risk,
          path_planner: 'workspace_waypoint_planner'
        };
      }
    });
  }
}
