import type { TaskDSL, TaskStep } from '../../types/taskDsl';

export type RuntimeDeviceType =
  | 'robot_arm'
  | 'mobile_robot'
  | 'smart_light'
  | 'camera_sensor'
  | 'conveyor_belt'
  | 'plc_cabinet'
  | 'lab_instrument'
  | 'warehouse_rack'
  | 'sensor_box'
  | 'drone_unit'
  | 'unknown_device';

export type CapabilityCategory =
  | 'observation'
  | 'motion'
  | 'manipulation'
  | 'actuation'
  | 'transport'
  | 'process'
  | 'system'
  | 'safety';

export type SupportLevel =
  | 'simulation_only'
  | 'read_only'
  | 'coming_soon'
  | 'unsupported';

export type RuntimeRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ExecutionPermission = 'simulation_only' | 'read_only' | 'ask_human' | 'blocked';
export type GoalAmbiguity = 'clear' | 'ambiguous' | 'unknown';
export type GoalPrecisionRequirement = 'low' | 'medium' | 'high';
export type RuntimeDecisionStatus =
  | 'compiled'
  | 'blocked'
  | 'unsupported'
  | 'ambiguous'
  | 'not_runnable'
  | 'ask_human';

export type GoalType =
  | 'pick_and_place'
  | 'precision_place'
  | 'insert_object'
  | 'align_object'
  | 'assemble_object'
  | 'capture_image'
  | 'scan_area'
  | 'read_state'
  | 'inspect'
  | 'turn_on'
  | 'turn_off'
  | 'set_color'
  | 'set_brightness'
  | 'set_speed'
  | 'set_temperature'
  | 'set_value'
  | 'convey_item'
  | 'sort_item'
  | 'route_item'
  | 'measure'
  | 'dispense'
  | 'heat'
  | 'cool'
  | 'test'
  | 'return_home'
  | 'stop'
  | 'emergency_stop'
  | 'throw_object'
  | 'smash_object'
  | 'move_outside_workspace'
  | 'destructive_action'
  | 'unsafe_speed'
  | 'ambiguous_action'
  | 'unsupported_goal';

export interface CapabilityContract {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  requiredInputs: string[];
  optionalInputs: string[];
  outputs: string[];
  preconditions: string[];
  effects: string[];
  riskLevel: RuntimeRiskLevel;
  executionPermission: ExecutionPermission;
  requiresWorldState: boolean;
  requiresSimulation: boolean;
  requiresHumanApproval: boolean;
}

export interface DeviceManifest {
  deviceId: string;
  displayName: string;
  category:
    | 'manipulator'
    | 'mobile_robot'
    | 'sensor'
    | 'actuator'
    | 'conveyor'
    | 'plc'
    | 'lab_instrument'
    | 'drone'
    | 'camera'
    | 'smart_light'
    | 'warehouse_system'
    | 'generic_device';
  supportLevel: SupportLevel;
  capabilities: CapabilityContract[];
  workspace: {
    allowedZones: string[];
    forbiddenZones: string[];
  };
  constraints: {
    maxSpeed: 'slow' | 'normal' | 'fast';
    maxForce: 'low' | 'medium' | 'high';
    precisionLevel: 'low' | 'medium' | 'high';
    requiresCollisionCheck: boolean;
    requiresSimulation: boolean;
    requiresHumanApproval: boolean;
  };
  riskProfile: {
    baseRisk: RuntimeRiskLevel;
    hazardousCapabilities: string[];
    blockedGoals: GoalType[];
  };
  adapter: {
    simulationAdapter: string;
    realAdapterEnabled: boolean;
  };
}

export interface WorldObject {
  id: string;
  type: string;
  color?: string;
  zone?: string;
  pose?: [number, number, number];
  movable?: boolean;
}

export interface WorldZone {
  id: string;
  label: string;
  safe: boolean;
}

export interface WorldDeviceState {
  deviceId: string;
  status: 'idle' | 'selected' | 'executing' | 'blocked' | 'completed';
  selected: boolean;
  supportLevel: SupportLevel;
}

export interface WorldModel {
  objects: WorldObject[];
  zones: WorldZone[];
  devices: WorldDeviceState[];
  confidence: 'high' | 'medium' | 'low';
}

export interface Goal {
  goalType: GoalType;
  targetDeviceId: string;
  objectRef?: string;
  targetZone?: string;
  desiredState?: Record<string, string | number | boolean>;
  parameters?: Record<string, string | number | boolean>;
  precisionRequirement: GoalPrecisionRequirement;
  riskHint: RuntimeRiskLevel;
  ambiguity: GoalAmbiguity;
}

export interface GoalCompileResult {
  goal: Goal;
  confidence: number;
  reason: string;
}

export interface RuntimePlanStep {
  stepId: string;
  capabilityId: string;
  action: TaskStep['action'];
  target?: string;
  value?: string | number | boolean;
  speed?: 'slow' | 'normal' | 'fast';
  force?: 'low' | 'medium' | 'high';
  zone?: string;
  note?: string;
}

export interface RuntimePlan {
  requiredCapabilities: string[];
  missingCapabilities: string[];
  steps: RuntimePlanStep[];
  confidence: number;
  reason: string;
}

export interface SafetyEnvelope {
  allowedExecutionMode: ExecutionPermission;
  requiresSimulation: boolean;
  requiresHumanApproval: boolean;
  maxSpeed: 'slow' | 'normal' | 'fast';
  maxForce: 'low' | 'medium' | 'high';
  allowedZones: string[];
  forbiddenZones: string[];
  collisionCheckRequired: boolean;
  reason: string;
}

export interface SafetyDecision {
  status: 'allowed' | 'blocked' | 'unsupported' | 'ambiguous' | 'not_runnable' | 'ask_human';
  safetyEnvelope: SafetyEnvelope;
  reason: string;
}

export interface OpenRealityTaskDSL extends TaskDSL {
  targetDeviceId: string;
  deviceCategory: DeviceManifest['category'];
  goalType: GoalType;
  steps: Array<TaskStep & { capabilityId: string; constraints?: Record<string, unknown> }>;
  safetyEnvelope: SafetyEnvelope;
  executionMode: 'simulation_only' | 'read_only';
  humanApprovalRequired?: boolean;
  audit: {
    originalPrompt: string;
    targetDeviceId: string;
    compilerVersion: string;
    generatedAt: string;
  };
}

export interface OpenRealityRuntimeInput {
  userPrompt: string;
  targetDeviceId: string;
  manifest: DeviceManifest;
  worldModel: WorldModel;
  locale?: 'zh' | 'en';
  /**
   * Optional pre-compiled goal (e.g. bridged from a validated LLM proposal).
   * Replaces ONLY the keyword goal compiler; every downstream check
   * (world grounding, plan, SafetyGovernor) still runs unchanged on it.
   */
  goalOverride?: GoalCompileResult;
}

export interface OpenRealityRuntimeResult {
  status: RuntimeDecisionStatus;
  goal: Goal;
  plan: RuntimePlan;
  safetyDecision: SafetyDecision;
  taskDsl?: OpenRealityTaskDSL;
  confidence: number;
  reason: string;
  userFacingMessage: string;
}
