export interface ObjectGeometry {
  id: string;
  shape: 'cube';
  size: number;
  position: [number, number, number];
}

export interface GraspCandidate {
  objectId: string;
  strategy: 'side_pinch';
  preGraspPose: [number, number, number];
  contactPose: [number, number, number];
  attachOffset: [number, number, number];
  openWidth: number;
  closeWidth: number;
  confidence: number;
  fingerClearance: number;
  contactOffset: [number, number, number];
  attachBlendOffset: [number, number, number];
  placeClearance: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function planCubeSidePinchGrasp(object: ObjectGeometry): GraspCandidate {
  const halfSize = object.size / 2;
  const fingerThickness = 0.07;
  const fingerCenterBias = 0.045;
  const fingerClearance = clamp(object.size * 0.08, 0.008, 0.022);
  const contactDepth = clamp(halfSize * 0.32, 0.02, 0.05);
  const liftClearance = clamp(object.size * 1.18, 0.18, 0.32);
  const placeClearance = clamp(object.size * 0.82, 0.18, 0.28);
  const closeInnerGap = object.size + fingerClearance * 2;
  const closeWidth = clamp(closeInnerGap - (fingerCenterBias * 2 - fingerThickness), 0.05, 0.22);
  const openWidth = clamp(closeWidth + object.size * 0.34 + fingerClearance * 2, closeWidth + 0.05, 0.28);
  const attachOffset: [number, number, number] = [
    halfSize + fingerThickness * 0.32 - contactDepth,
    -(halfSize * 0.18 + fingerClearance * 0.4),
    0
  ];
  const contactPose: [number, number, number] = [
    object.position[0] - attachOffset[0],
    object.position[1] - attachOffset[1],
    object.position[2]
  ];
  const preGraspPose: [number, number, number] = [
    contactPose[0] - clamp(object.size * 0.16, 0.025, 0.06),
    contactPose[1] + liftClearance,
    contactPose[2]
  ];
  const contactOffset: [number, number, number] = [
    object.position[0] - contactPose[0],
    object.position[1] - contactPose[1],
    0
  ];
  const attachBlendOffset: [number, number, number] = [
    attachOffset[0] - contactOffset[0],
    attachOffset[1] - contactOffset[1],
    0
  ];

  return {
    objectId: object.id,
    strategy: 'side_pinch',
    preGraspPose,
    contactPose,
    attachOffset,
    openWidth,
    closeWidth,
    confidence: 0.82
    ,
    fingerClearance,
    contactOffset,
    attachBlendOffset,
    placeClearance
  };
}
