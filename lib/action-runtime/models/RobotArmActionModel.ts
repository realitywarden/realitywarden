import type { DeviceActionContext, DeviceActionModel } from '../DeviceActionModel';
import { solvePlanarTwoLinkIk } from '../Kinematics';
import { frameProgress } from '../ActionInterpolator';
import { validateCommandForAction } from '../ActionValidation';
import { makeBlockedPlan, targetPosition, lerp, lerpVec3, speedDuration } from './modelUtils';
import { planCubeSidePinchGrasp, type GraspCandidate, type ObjectGeometry } from '@/lib/planning/GraspPlanner';

const HOME_GRIP: [number, number, number] = [0.82, 1.38, 0];
const HOME_OBJECT: [number, number, number] = [-0.55, 0.18, 0.2];
const PHASE_DURATIONS = {
  planning: 300,
  detect_object_geometry: 220,
  select_grasp_candidate: 220,
  move_to_pre_grasp: 800,
  descend_to_contact: 500,
  close_gripper: 400,
  attach_object: 180,
  lift_object: 500,
  move_to_target: 1000,
  descend_to_place: 500,
  open_gripper: 360,
  detach_object: 180,
  retract: 800
} as const;

type RobotArmPhaseName = keyof typeof PHASE_DURATIONS;

interface RobotArmPose {
  grip: [number, number, number];
  object: [number, number, number];
  attached: boolean;
  attachProgress: number;
  gripperWidth: number;
  holdingObject: string | null;
  attachOffset: [number, number, number];
  contactHighlight: boolean;
  graspCandidate: GraspCandidate | null;
}

interface RobotArmPhase {
  name: RobotArmPhaseName;
  durationMs: number;
  from: RobotArmPose;
  to: RobotArmPose;
  easing: (progress: number) => number;
}

export class RobotArmActionModel implements DeviceActionModel {
  plan({ command, deviceMeta, geometry, currentState }: DeviceActionContext) {
    const motionTarget = command.action === 'release' ? String(command.payload.zone ?? command.target ?? '') : command.target;
    const target = targetPosition(motionTarget, geometry);
    const startGrip = (currentState.gripper_position as [number, number, number]) ?? [0.82, 1.38, 0];
    const validation = validateCommandForAction(command, deviceMeta, geometry);
    if (validation.blocked) return makeBlockedPlan(command, deviceMeta, currentState, validation);
    const objectId = typeof currentState.holding_object === 'string'
      ? currentState.holding_object
      : typeof command.target === 'string' && command.target in geometry.objects
        ? command.target
        : 'red_cube';
    const objectGeometry = geometry.objects[objectId as keyof typeof geometry.objects];
    const objectSize = objectGeometry && 'size' in objectGeometry ? objectGeometry.size : 0.2;
    const startObject = resolveObjectPosition(currentState, geometry, objectId);
    const startHolding = typeof currentState.holding_object === 'string' ? currentState.holding_object : null;
    const graspObject: ObjectGeometry = {
      id: objectId,
      shape: 'cube',
      size: objectSize,
      position: startObject
    };
    const graspCandidate = planCubeSidePinchGrasp(graspObject);
    const startWidth = typeof currentState.gripper_width === 'number' ? currentState.gripper_width : graspCandidate.openWidth;
    const startPose: RobotArmPose = {
      grip: startGrip,
      object: startObject,
      attached: Boolean(startHolding),
      attachProgress: startHolding ? 1 : 0,
      gripperWidth: startWidth,
      holdingObject: startHolding,
      attachOffset: graspCandidate.attachOffset,
      contactHighlight: false,
      graspCandidate
    };
    const objectPreGrasp = graspCandidate.preGraspPose;
    const objectTouch = graspCandidate.contactPose;
    const objectLift = poseAbove(startObject, 0.56);
    const targetPlace = placePoseForTarget(command.payload.zone ?? command.target, geometry, objectId);
    const targetAbove = poseAbove(targetPlace, Math.max(graspCandidate.placeClearance + 0.18, 0.44));
    const targetTouch = [
      targetPlace[0] - graspCandidate.attachOffset[0] + Math.min(0.012, graspCandidate.fingerClearance * 0.6),
      targetPlace[1] - graspCandidate.attachOffset[1],
      targetPlace[2]
    ] as [number, number, number];
    const homePose: RobotArmPose = {
      grip: HOME_GRIP,
      object: startHolding ? applyAttachedOffset(HOME_GRIP, graspCandidate.attachOffset) : startObject,
      attached: Boolean(startHolding),
      attachProgress: startHolding ? 1 : 0,
      gripperWidth: startHolding ? graspCandidate.closeWidth : graspCandidate.openWidth,
      holdingObject: startHolding,
      attachOffset: graspCandidate.attachOffset,
      contactHighlight: false,
      graspCandidate
    };
    if (command.action === 'scan_area' || command.action === 'identify_object') {
      return createRobotArmPlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState: {
          ...currentState,
          status: command.action === 'scan_area' ? 'scanned' : 'identified',
          last_target: command.target,
          detected_object: command.action === 'identify_object' ? command.target : currentState.detected_object,
          gripper_position: startGrip
        },
        phases: [
          {
            name: 'planning',
            durationMs: PHASE_DURATIONS.planning,
            from: startPose,
            to: startPose,
            easing: easeInOutCubic
          }
        ]
      });
    }
    if (command.action === 'move_to_pose') {
      const carrying = Boolean(currentState.holding_object);
      const phases: RobotArmPhase[] =
        carrying
          ? [
              { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic },
              {
                name: 'move_to_target',
                durationMs: speedDuration(command.payload.speed, PHASE_DURATIONS.move_to_target),
                from: startPose,
                to: { ...startPose, grip: targetAbove, object: applyAttachedOffset(targetAbove, graspCandidate.attachOffset), attached: true, attachProgress: 1, gripperWidth: graspCandidate.closeWidth, holdingObject: startHolding, contactHighlight: false },
                easing: easeInOutCubic
              }
            ]
          : [
              { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic },
              {
                name: 'detect_object_geometry',
                durationMs: PHASE_DURATIONS.detect_object_geometry,
                from: startPose,
                to: { ...startPose, graspCandidate },
                easing: easeInOutCubic
              },
              {
                name: 'select_grasp_candidate',
                durationMs: PHASE_DURATIONS.select_grasp_candidate,
                from: { ...startPose, graspCandidate },
                to: { ...startPose, graspCandidate },
                easing: easeInOutCubic
              },
              {
                name: 'move_to_pre_grasp',
                durationMs: speedDuration(command.payload.speed, PHASE_DURATIONS.move_to_pre_grasp),
                from: startPose,
                to: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false },
                easing: easeInOutCubic
              }
            ];
      const finalGrip = carrying ? targetAbove : objectPreGrasp;
      return createRobotArmPlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState: {
          ...currentState,
          status: 'completed',
          current_position: command.target,
          gripper_position: finalGrip,
          last_target: command.target
        },
        phases
      });
    }

    if (command.action === 'grasp') {
      const phases: RobotArmPhase[] = [
        { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic },
        {
          name: 'detect_object_geometry',
          durationMs: PHASE_DURATIONS.detect_object_geometry,
          from: startPose,
          to: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'select_grasp_candidate',
          durationMs: PHASE_DURATIONS.select_grasp_candidate,
          from: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          to: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'move_to_pre_grasp',
          durationMs: speedDuration(command.payload.speed, 320),
          from: { ...startPose, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          to: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'descend_to_contact',
          durationMs: PHASE_DURATIONS.descend_to_contact,
          from: { ...startPose, grip: objectPreGrasp, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          to: { ...startPose, grip: objectTouch, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'close_gripper',
          durationMs: PHASE_DURATIONS.close_gripper,
          from: { ...startPose, grip: objectTouch, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: true, graspCandidate },
          to: { ...startPose, grip: objectTouch, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.closeWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'attach_object',
          durationMs: Math.max(PHASE_DURATIONS.attach_object, 220),
          from: { ...startPose, grip: objectTouch, object: startObject, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.closeWidth, contactHighlight: true, graspCandidate },
          to: { ...startPose, grip: objectTouch, object: applyAttachedOffset(objectTouch, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: typeof command.target === 'string' ? command.target : objectId, gripperWidth: graspCandidate.closeWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'lift_object',
          durationMs: PHASE_DURATIONS.lift_object,
          from: { ...startPose, grip: objectTouch, object: applyAttachedOffset(objectTouch, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: typeof command.target === 'string' ? command.target : objectId, gripperWidth: graspCandidate.closeWidth, attachOffset: graspCandidate.attachOffset, contactHighlight: false, graspCandidate },
          to: { grip: objectLift, object: applyAttachedOffset(objectLift, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: typeof command.target === 'string' ? command.target : objectId, gripperWidth: graspCandidate.closeWidth, attachOffset: graspCandidate.attachOffset, contactHighlight: false, graspCandidate },
          easing: easeOutCubic
        }
      ];
      return createRobotArmPlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState: {
          ...currentState,
          status: 'completed',
          holding_object: command.target,
          gripper_width: graspCandidate.closeWidth,
          gripper_position: objectLift,
          object_position: applyAttachedOffset(objectLift, graspCandidate.attachOffset)
        },
        phases
      });
    }

    if (command.action === 'release') {
      const releaseGrip = targetTouch;
      const releaseCube = targetPlace;
      const phases: RobotArmPhase[] = [
        { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic },
        {
          name: 'descend_to_place',
          durationMs: Math.max(PHASE_DURATIONS.descend_to_place, 620),
          from: { ...startPose, object: applyAttachedOffset(startGrip, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: startHolding, gripperWidth: graspCandidate.closeWidth, contactHighlight: false, graspCandidate },
          to: { ...startPose, grip: releaseGrip, object: applyAttachedOffset(releaseGrip, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: startHolding, gripperWidth: graspCandidate.closeWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'open_gripper',
          durationMs: Math.max(PHASE_DURATIONS.open_gripper, 420),
          from: { ...startPose, grip: releaseGrip, object: applyAttachedOffset(releaseGrip, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: startHolding, gripperWidth: graspCandidate.closeWidth, contactHighlight: true, graspCandidate },
          to: { ...startPose, grip: releaseGrip, object: applyAttachedOffset(releaseGrip, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: startHolding, gripperWidth: graspCandidate.openWidth, contactHighlight: true, graspCandidate },
          easing: easeInOutCubic
        },
        {
          name: 'detach_object',
          durationMs: Math.max(PHASE_DURATIONS.detach_object, 220),
          from: { ...startPose, grip: releaseGrip, object: applyAttachedOffset(releaseGrip, graspCandidate.attachOffset), attached: true, attachProgress: 1, holdingObject: startHolding, gripperWidth: graspCandidate.openWidth, contactHighlight: true, graspCandidate },
          to: { ...startPose, grip: releaseGrip, object: releaseCube, attached: false, attachProgress: 0, holdingObject: null, gripperWidth: graspCandidate.openWidth, contactHighlight: false, graspCandidate },
          easing: easeInOutCubic
        }
      ];
      return createRobotArmPlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState: {
          ...currentState,
          status: 'completed',
          holding_object: null,
          object_location: command.payload.zone ?? command.target,
          object_position: releaseCube,
          gripper_position: releaseGrip,
          gripper_width: graspCandidate.openWidth
        },
        phases
      });
    }

    if (command.action === 'return_home') {
      return createRobotArmPlan({
        command,
        deviceMeta,
        geometry,
        currentState,
        endState: {
          ...currentState,
          status: 'completed',
          current_position: 'home',
          gripper_position: HOME_GRIP,
          joint_angles: ikForPose(HOME_GRIP, geometry)
        },
        phases: [
          { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic },
          {
            name: 'retract',
            durationMs: speedDuration(command.payload.speed, PHASE_DURATIONS.retract),
            from: startPose,
            to: homePose,
            easing: easeInOutCubic
          }
        ]
      });
    }

    return createRobotArmPlan({
      command,
      deviceMeta,
      geometry,
      currentState,
      endState: {
        ...currentState,
        status: 'completed',
        current_position: command.target,
        gripper_position: target,
        last_target: command.target
      },
      phases: [
        { name: 'planning', durationMs: PHASE_DURATIONS.planning, from: startPose, to: startPose, easing: easeInOutCubic }
      ]
    });
  }
}

function createRobotArmPlan({
  command,
  deviceMeta,
  geometry,
  currentState,
  endState,
  phases
}: {
  command: DeviceActionContext['command'];
  deviceMeta: DeviceActionContext['deviceMeta'];
  geometry: DeviceActionContext['geometry'];
  currentState: DeviceActionContext['currentState'];
  endState: Record<string, unknown>;
  phases: RobotArmPhase[];
}) {
  const validation = validateCommandForAction(command, deviceMeta, geometry);
  if (validation.blocked) return makeBlockedPlan(command, deviceMeta, currentState, validation);

  const frames = phases.flatMap((phase, phaseIndex, phaseList) => {
    const samples = frameProgress(Math.max(3, Math.ceil(phase.durationMs / 100) + 1));
    return samples
      .filter((_, sampleIndex) => phaseIndex === 0 || sampleIndex > 0)
      .map((sample) => {
        const eased = phase.easing(sample);
        const pose = interpolatePose(phase.from, phase.to, eased, phase.name, sample);
        const kinematics = solvePlanarTwoLinkIk(pose.grip, geometry);
        const elapsed = phaseList
          .slice(0, phaseIndex)
          .reduce((sum, item) => sum + item.durationMs, 0);
        const timeMs = Math.round(elapsed + phase.durationMs * sample);
        const lastPhase = phaseIndex === phaseList.length - 1 && sample >= 1;
        return {
          time_ms: timeMs,
          progress: totalProgress(timeMs, phaseList),
          device_state: lastPhase
            ? endState
            : {
                ...currentState,
                status: 'executing',
                gripper_position: pose.grip,
                gripper_width: pose.gripperWidth,
                holding_object: pose.holdingObject ?? undefined,
                object_position: pose.object
              },
          visual_state: {
            phase: phase.name,
            phase_progress: sample,
            gripper_position: pose.grip,
            end_effector_position: pose.grip,
            gripper_width: pose.gripperWidth,
            object_position: pose.object,
            attached_object: pose.attached,
            attached_object_id: pose.holdingObject,
            holding_object: pose.holdingObject,
            attach_progress: pose.attachProgress,
            attach_offset: pose.attachOffset,
            contact_highlight: pose.contactHighlight,
            grasp_candidate: pose.graspCandidate,
            base_yaw: Math.atan2(pose.grip[2], pose.grip[0] || 0.0001),
            target_position: phase.to.grip,
            path_points: [phase.from.grip, phase.to.grip],
            joint_angles: [kinematics.shoulder, kinematics.elbow],
            kinematics: {
              solver: 'planar_two_link_ik',
              reachable: kinematics.reachable,
              reach: kinematics.reach,
              max_reach: kinematics.max_reach
            }
          },
          command_id: command.id,
          status: lastPhase ? 'completed' as const : 'running' as const
        };
      });
  });

  return {
    action_plan_id: `plan-${command.id}`,
    command_id: command.id,
    device_type: deviceMeta.device_type,
    action: command.action,
    target: command.target,
    start_state: currentState,
    end_state: endState,
    duration_ms: phases.reduce((sum, phase) => sum + phase.durationMs, 0),
    frames,
    validation
  };
}

function resolveObjectPosition(currentState: Record<string, unknown>, geometry: DeviceActionContext['geometry'], objectId: string): [number, number, number] {
  if (Array.isArray(currentState.object_position)) return currentState.object_position as [number, number, number];
  const fromObject = geometry.objects[objectId as keyof typeof geometry.objects];
  if (typeof currentState.object_location === 'string') {
    const zone = geometry.zones[currentState.object_location];
    if (zone) return [zone.position[0], 0.18, zone.position[2]];
  }
  return fromObject?.position ?? HOME_OBJECT;
}

function placePoseForTarget(target: unknown, geometry: DeviceActionContext['geometry'], objectId: string): [number, number, number] {
  if (typeof target === 'string' && geometry.zones[target]) return [geometry.zones[target].position[0], 0.18, geometry.zones[target].position[2]];
  if (typeof target === 'string' && geometry.objects[target as keyof typeof geometry.objects]) return geometry.objects[target as keyof typeof geometry.objects].position;
  const fallback = geometry.objects[objectId as keyof typeof geometry.objects];
  return fallback?.position ?? HOME_OBJECT;
}

function poseAbove(point: [number, number, number], clearance: number): [number, number, number] {
  return [point[0], Math.max(point[1] + clearance, 0.6), point[2]];
}

function applyAttachedOffset(grip: [number, number, number], offset: [number, number, number]): [number, number, number] {
  return [grip[0] + offset[0], grip[1] + offset[1], grip[2] + offset[2]];
}

function interpolatePose(from: RobotArmPose, to: RobotArmPose, progress: number, phase: RobotArmPhaseName, phaseProgress: number): RobotArmPose {
  const grip = lerpVec3(from.grip, to.grip, progress);
  const attachOffset = to.attachOffset ?? from.attachOffset;
  const graspCandidate = to.graspCandidate ?? from.graspCandidate;
  const attachThreshold = 0.72;
  const rawAttachBlend = phase === 'attach_object'
    ? Math.min(1, Math.max(0, (phaseProgress - attachThreshold) / (1 - attachThreshold)))
    : phase === 'detach_object'
      ? Math.max(0, Math.min(1, 1 - phaseProgress / 0.58))
      : to.attachProgress;
  const attachBlend = easeInOutCubic(rawAttachBlend);
  let attached = to.attached;
  if (phase === 'close_gripper') attached = false;
  if (phase === 'attach_object') attached = rawAttachBlend > 0;
  if (phase === 'open_gripper') attached = true;
  if (phase === 'detach_object') attached = rawAttachBlend > 0;
  const holdingObject = attached ? to.holdingObject : null;
  const attachedObject = applyAttachedOffset(grip, attachOffset);
  const attachBlendTarget = graspCandidate
    ? [
        from.object[0] + graspCandidate.attachBlendOffset[0],
        from.object[1] + graspCandidate.attachBlendOffset[1],
        from.object[2] + graspCandidate.attachBlendOffset[2]
      ] as [number, number, number]
    : attachedObject;
  const object = phase === 'close_gripper'
    ? from.object
    : phase === 'attach_object'
      ? lerpVec3(lerpVec3(from.object, attachBlendTarget, Math.min(1, attachBlend * 0.7)), attachedObject, attachBlend)
      : phase === 'detach_object'
        ? lerpVec3(attachedObject, to.object, 1 - easeOutCubic(attachBlend))
        : attached
          ? attachedObject
          : lerpVec3(from.object, to.object, progress);
  return {
    grip,
    object,
    attached,
    attachProgress: phase === 'attach_object'
      ? rawAttachBlend
      : phase === 'detach_object'
        ? rawAttachBlend
        : to.attachProgress,
    gripperWidth: lerp(from.gripperWidth, to.gripperWidth, progress),
    holdingObject,
    attachOffset,
    contactHighlight: (phase === 'descend_to_contact' && phaseProgress > 0.35)
      || phase === 'close_gripper'
      || (phase === 'attach_object' && phaseProgress < 0.82)
      || (phase === 'open_gripper' && phaseProgress < 0.55),
    graspCandidate
  };
}

function totalProgress(timeMs: number, phases: RobotArmPhase[]) {
  const totalDuration = phases.reduce((sum, phase) => sum + phase.durationMs, 0);
  if (totalDuration <= 0) return 1;
  return Math.min(1, Math.max(0, timeMs / totalDuration));
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function ikForPose(target: [number, number, number], geometry: DeviceActionContext['geometry']) {
  const ik = solvePlanarTwoLinkIk(target, geometry);
  return [ik.shoulder, ik.elbow];
}
