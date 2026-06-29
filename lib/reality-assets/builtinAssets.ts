import { getOpenRealityDeviceManifest } from '../open-reality-runtime/deviceManifests';
import type { RuntimeDeviceType, WorldModel } from '../open-reality-runtime/types';
import type {
  RealityAssetAdapterBoundary,
  RealityAssetExamplePrompts,
  RealityAssetPackage,
  RealityAssetValidationRules
} from './types';

const defaultZones: WorldModel['zones'] = [
  { id: 'pickup_zone', label: 'Pickup Zone', safe: true },
  { id: 'left_safe_zone', label: 'Left Safe Zone', safe: true },
  { id: 'right_safe_zone', label: 'Right Safe Zone', safe: true },
  { id: 'front_safe_zone', label: 'Front Safe Zone', safe: true },
  { id: 'back_safe_zone', label: 'Back Safe Zone', safe: true },
  { id: 'outside_table', label: 'Outside Table', safe: false },
  { id: 'current_area', label: 'Current Area', safe: true }
];

const validationRules: RealityAssetValidationRules = {
  requiresDeviceManifest: true,
  requiresCapabilityContracts: true,
  requiresSupportLevel: true,
  realAdapterMustBeDisabled: true,
  comingSoonMustNotBeRunnable: true,
  unsupportedMustNotFallback: true,
  requiresExamplePrompt: true
};

function adapterBoundary(deviceType: RuntimeDeviceType): RealityAssetAdapterBoundary {
  const manifest = getOpenRealityDeviceManifest(deviceType);
  const readOnly = manifest.supportLevel === 'read_only';
  const runnable = manifest.supportLevel === 'simulation_only' || readOnly;
  return {
    simulationAdapterAvailable: runnable,
    realAdapterEnabled: false,
    modes: runnable ? [readOnly ? 'read_only' : 'simulation', 'real_disabled'] : ['real_disabled'],
    taskDslIsHardwareCommand: false,
    adapterNote: runnable
      ? 'TaskDSL may enter the local simulation adapter boundary only. It is not a hardware command.'
      : 'This asset is inspectable but not runnable in the Public Alpha runtime.'
  };
}

function prompts(deviceType: RuntimeDeviceType): RealityAssetExamplePrompts {
  if (deviceType === 'robot_arm') {
    return {
      supported: ['Move the red cube to the back safe zone.', '把红方块放到后侧安全区。'],
      unsupported: ['Assemble the gearbox.', '把零件压装到轴承里。'],
      unsafe: ['Throw the red cube off the table.', '把红方块扔出桌面。'],
      ambiguous: ['Move the cube to the safe zone.', '把方块放到安全区。']
    };
  }
  if (deviceType === 'smart_light') {
    return {
      supported: ['Turn on the light.', 'Set the light to blue.', '打开智能灯。', '把灯改成蓝色。'],
      unsupported: ['Make the light purple.', '让灯进入派对模式。'],
      unsafe: ['Flash the light at unsafe speed.', '高频闪烁智能灯。'],
      ambiguous: ['Adjust the light.', '调一下灯。']
    };
  }
  if (deviceType === 'camera_sensor') {
    return {
      supported: ['Take a photo.', 'Read camera status.', '拍一张照片。', '读取摄像头状态。'],
      unsupported: ['Track every person in the room.', '识别所有人的身份。'],
      unsafe: ['Capture the privacy zone.', '采集隐私区画面。'],
      ambiguous: ['Check the camera.', '看一下摄像头。']
    };
  }
  return {
    supported: [],
    unsupported: ['Run this device now.', '立即运行这个设备。'],
    unsafe: ['Bypass safety and execute.', '绕过安全机制执行。'],
    ambiguous: ['Do the normal task.', '执行常规任务。']
  };
}

function worldModelObjects(deviceType: RuntimeDeviceType): WorldModel['objects'] {
  if (deviceType === 'robot_arm') {
    return [
      { id: 'red_cube', type: 'cube', color: 'red', zone: 'pickup_zone', pose: [0, 0, 0], movable: true },
      { id: 'table_workspace', type: 'workspace', zone: 'table_workspace', movable: false }
    ];
  }
  if (deviceType === 'smart_light') {
    return [{ id: 'light_panel', type: 'smart_light_panel', zone: 'current_area', movable: false }];
  }
  if (deviceType === 'camera_sensor') {
    return [{ id: 'camera_view', type: 'sensor_view', zone: 'current_area', movable: false }];
  }
  return [{ id: `${deviceType}_placeholder`, type: deviceType, zone: 'current_area', movable: false }];
}

function asset(deviceType: RuntimeDeviceType, name: string): RealityAssetPackage {
  const manifest = getOpenRealityDeviceManifest(deviceType);
  return {
    assetId: `openreality.${deviceType}`,
    name,
    version: '0.2.0-sprint.1',
    vendor: 'open-reality',
    deviceType,
    deviceManifest: manifest,
    capabilityContracts: manifest.capabilities,
    worldModelAssumptions: {
      objects: worldModelObjects(deviceType),
      zones: defaultZones,
      confidence: manifest.supportLevel === 'coming_soon' ? 'medium' : 'high'
    },
    adapterBoundary: adapterBoundary(deviceType),
    examplePrompts: prompts(deviceType),
    validationRules,
    supportLevel: manifest.supportLevel,
    safetyNotes: [
      'Simulation-first Public Alpha asset.',
      'Real device execution is disabled.',
      manifest.supportLevel === 'coming_soon'
        ? 'This device is protocol-shaped but not runnable.'
        : 'This device can enter only the local simulation/read-only runtime boundary.'
    ]
  };
}

export const BUILTIN_REALITY_ASSETS: RealityAssetPackage[] = [
  asset('robot_arm', 'Robot Arm Reality Asset'),
  asset('smart_light', 'Smart Light Reality Asset'),
  asset('camera_sensor', 'Camera Sensor Reality Asset'),
  asset('mobile_robot', 'Mobile Robot Reality Asset'),
  asset('conveyor_belt', 'Conveyor Belt Reality Asset'),
  asset('plc_cabinet', 'PLC Cabinet Reality Asset'),
  asset('lab_instrument', 'Lab Instrument Reality Asset'),
  asset('drone_unit', 'Drone Unit Reality Asset')
];
