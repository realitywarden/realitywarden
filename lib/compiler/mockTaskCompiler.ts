import type { DeviceType } from '@/types/deviceMeta';
import type { TaskDSL, TaskStep } from '@/types/taskDsl';

export interface PromptCompileResult {
  ok: boolean;
  task?: TaskDSL;
  code?: 'unsupported_prompt';
  message?: string;
}

function taskId(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function normalizePrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/[.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function parseRobotArmPickPlacePrompt(prompt: string) {
  const normalized = normalizePrompt(prompt);
  // Regression anchors for compiler tests: '\u524d\u4fa7' -> 'front_safe_zone', '\u540e\u4fa7' -> 'back_safe_zone'
  const object = includesAny(normalized, ['blue_cube', 'blue cube', 'blue block', '蓝色', '蓝方块', '蓝色方块'])
    ? 'blue_cube'
    : 'red_cube';
  const destination = includesAny(normalized, ['left_safe_zone', 'left safe zone', 'left zone', 'left side', '左侧', '左边', '左安全区'])
    ? 'left_safe_zone'
    : includesAny(normalized, ['front_safe_zone', 'front safe zone', 'front zone', 'front side', 'front', '前侧', '前方', '前面', '前端', '前侧安全区'])
      ? 'front_safe_zone'
      : includesAny(normalized, ['inspection_zone', 'inspection zone', 'inspect', '检查区', '检查'])
        ? 'inspection_zone'
        : includesAny(normalized, ['back_safe_zone', 'back safe zone', 'back zone', 'back side', 'rear', 'back', '后侧', '后方', '后面', '后侧安全区'])
          ? 'back_safe_zone'
          : 'right_safe_zone';
  const pickupZone = object === 'blue_cube' ? 'inspection_zone' : 'pickup_zone';
  const speed = includesAny(normalized, ['slow', '慢', '缓慢', '低速']) ? 'slow' : 'normal';
  const force = includesAny(normalized, ['gentle', 'light', '轻', '小力']) ? 'low' : 'medium';

  return { object, destination, pickupZone, speed, force } as const;
}

function robotArmPickPlaceSteps(prompt: string): TaskStep[] {
  const intent = parseRobotArmPickPlacePrompt(prompt);
  return [
    { id: 'step-1', action: 'identify_object', target: intent.object, speed: 'slow' },
    { id: 'step-2', action: 'move_to_pose', target: intent.object, speed: intent.speed, zone: intent.pickupZone },
    { id: 'step-3', action: 'grasp', target: intent.object, force: intent.force },
    {
      id: 'step-4',
      action: 'move_to_pose',
      target: intent.destination,
      speed: intent.speed,
      note: `Planned route carries ${intent.object} to ${intent.destination}.`
    },
    { id: 'step-5', action: 'release', target: intent.object, force: 'low', zone: intent.destination },
    { id: 'step-6', action: 'return_home', speed: 'slow' }
  ];
}

function smartLightSteps(prompt: string): TaskStep[] | null {
  const normalized = normalizePrompt(prompt);
  const wantsOn = includesAny(normalized, [
    'turn on the light', 'switch on the light', 'turn on light', 'switch on light', 'light on', 'lights on',
    '打开智能灯', '开灯'
  ]);
  const wantsOff = includesAny(normalized, [
    'turn off the light', 'switch off the light', 'turn off light', 'switch off light', 'light off', 'lights off',
    '关闭智能灯', '关灯'
  ]);
  const wantsBright = includesAny(normalized, [
    'make the light brighter', 'brighten the light', 'brighter', 'bright',
    '把灯调亮', '调亮一点', '调亮'
  ]);
  const wantsDim = includesAny(normalized, [
    'dim the light', 'make the light dimmer', 'dimmer', 'dim',
    '把灯调暗', '调暗一点', '调暗'
  ]);
  const wantsBlue = includesAny(normalized, [
    'set the light to blue', 'blue light', 'make the light blue', 'blue',
    '把灯改成蓝色', '蓝色灯光', '蓝灯'
  ]);
  const wantsRed = includesAny(normalized, [
    'set the light to red', 'red light', 'make the light red', 'red',
    '把灯改成红色', '红色灯光', '红灯'
  ]);
  const wantsGreen = includesAny(normalized, [
    'set the light to green', 'green light', 'make the light green', 'green',
    '把灯改成绿色', '绿色灯光', '绿灯'
  ]);

  if (wantsOff) {
    return [
      { id: 'step-1', action: 'set_brightness', target: 'lamp', value: 0, speed: 'slow' },
      { id: 'step-2', action: 'set_light', target: 'lamp', value: false, speed: 'slow' }
    ];
  }

  if (wantsOn || wantsBright || wantsDim || wantsBlue || wantsRed || wantsGreen) {
    const color = wantsBlue ? 'blue' : wantsRed ? 'red' : wantsGreen ? 'green' : 'warm_white';
    const brightness = wantsBright ? 85 : wantsDim ? 20 : 45;
    return [
      { id: 'step-1', action: 'set_light', target: 'lamp', value: true, speed: 'slow' },
      { id: 'step-2', action: 'set_brightness', target: 'lamp', value: brightness, speed: 'slow' },
      { id: 'step-3', action: 'set_color', target: 'lamp', value: color, speed: 'slow' }
    ];
  }

  return null;
}

function cameraSensorSteps(prompt: string): TaskStep[] | null {
  const normalized = normalizePrompt(prompt);
  const wantsStatus = includesAny(normalized, [
    'read camera status', 'read sensor state', 'camera state', 'camera status', 'read status', 'read state', 'status', 'state',
    '读取摄像头状态', '读取状态', '查看摄像头状态'
  ]);
  const wantsScan = includesAny(normalized, [
    'scan current area', 'scan area', 'scan the current area', 'scan',
    '扫描当前区域', '扫描区域'
  ]);
  const wantsPhoto = includesAny(normalized, [
    'take a photo', 'take a picture', 'capture a frame', 'capture snapshot', 'snapshot', 'take photo', 'take picture',
    '拍一张照片', '拍照', '截图', '捕获画面'
  ]);

  if (wantsStatus) {
    return [
      { id: 'step-1', action: 'read_sensor', target: 'camera_view', speed: 'slow' }
    ];
  }

  if (wantsScan && !wantsPhoto) {
    return [
      { id: 'step-1', action: 'read_sensor', target: 'camera_view', speed: 'slow' },
      { id: 'step-2', action: 'capture_frame', target: 'camera_view', speed: 'slow' }
    ];
  }

  if (wantsPhoto) {
    return [
      { id: 'step-1', action: 'capture_frame', target: 'camera_view', speed: 'slow' }
    ];
  }

  return null;
}

function safeStepsForDevice(deviceType: DeviceType, prompt = ''): TaskStep[] {
  if (deviceType === 'mobile_robot') {
    return [
      { id: 'step-1', action: 'scan_area', target: 'aisle_a', speed: 'slow' },
      { id: 'step-2', action: 'navigate_to', target: 'aisle_a', speed: 'normal' },
      { id: 'step-3', action: 'dock', target: 'charging_dock', speed: 'slow' }
    ];
  }
  if (deviceType === 'smart_light') {
    return smartLightSteps(prompt) ?? [];
  }
  if (deviceType === 'camera_sensor') {
    return cameraSensorSteps(prompt) ?? [];
  }
  if (deviceType === 'conveyor_belt') {
    return [
      { id: 'step-1', action: 'start_belt', target: 'belt', speed: 'slow' },
      { id: 'step-2', action: 'sort_item', target: 'bin_a', speed: 'normal' },
      { id: 'step-3', action: 'stop_belt', target: 'belt', speed: 'slow' }
    ];
  }
  if (deviceType === 'plc_cabinet') {
    return [
      { id: 'step-1', action: 'read_register', target: 'register_bank', speed: 'slow' },
      { id: 'step-2', action: 'start_sequence', target: 'safe_sequence', speed: 'slow' },
      { id: 'step-3', action: 'stop_sequence', target: 'safe_sequence', speed: 'slow' }
    ];
  }
  if (deviceType === 'lab_instrument') {
    return [
      { id: 'step-1', action: 'set_parameter', target: 'test_channel', value: 'nominal' },
      { id: 'step-2', action: 'start_test', target: 'test_channel', speed: 'slow' },
      { id: 'step-3', action: 'read_measurement', target: 'measurement_port', speed: 'slow' },
      { id: 'step-4', action: 'stop_test', target: 'test_channel', speed: 'slow' }
    ];
  }
  if (deviceType === 'warehouse_rack') {
    return [
      { id: 'step-1', action: 'scan_slot', target: 'rack_slot_a1', speed: 'slow' },
      { id: 'step-2', action: 'reserve_slot', target: 'rack_slot_a1', speed: 'slow' },
      { id: 'step-3', action: 'mark_item', target: 'rack_slot_a1', value: 'verified' }
    ];
  }
  if (deviceType === 'sensor_box') {
    return [
      { id: 'step-1', action: 'calibrate_sensor', target: 'sensor_probe', speed: 'slow' },
      { id: 'step-2', action: 'read_sensor', target: 'sensor_probe', speed: 'slow' },
      { id: 'step-3', action: 'reset_sensor', target: 'sensor_probe', speed: 'slow' }
    ];
  }
  return robotArmPickPlaceSteps(prompt);
}

function unsafeStepsForDevice(deviceType: DeviceType): TaskStep[] {
  if (deviceType === 'mobile_robot') {
    return [
      { id: 'step-1', action: 'navigate_to', target: 'restricted_zone', speed: 'fast' },
      { id: 'step-2', action: 'dock', target: 'outside_table', speed: 'fast' }
    ];
  }
  if (deviceType === 'smart_light') {
    return [
      { id: 'step-1', action: 'set_brightness', target: 'lamp', value: 100, speed: 'fast' },
      { id: 'step-2', action: 'set_color', target: 'operator_station', value: 'strobe', speed: 'fast' }
    ];
  }
  if (deviceType === 'camera_sensor') {
    return [
      { id: 'step-1', action: 'capture_frame', target: 'privacy_zone', speed: 'fast' },
      { id: 'step-2', action: 'read_sensor', target: 'privacy_zone', speed: 'fast' }
    ];
  }
  if (deviceType === 'conveyor_belt') {
    return [
      { id: 'step-1', action: 'start_belt', target: 'belt', speed: 'fast', force: 'high' },
      { id: 'step-2', action: 'sort_item', target: 'jam_zone', speed: 'fast', force: 'high' }
    ];
  }
  if (deviceType === 'plc_cabinet') {
    return [
      { id: 'step-1', action: 'write_register', target: 'restricted_zone', speed: 'fast', force: 'high' },
      { id: 'step-2', action: 'start_sequence', target: 'unsafe_zone', speed: 'fast' }
    ];
  }
  if (deviceType === 'lab_instrument') {
    return [
      { id: 'step-1', action: 'set_parameter', target: 'restricted_zone', value: 'unsafe', speed: 'fast' },
      { id: 'step-2', action: 'start_test', target: 'unsafe_zone', force: 'high' }
    ];
  }
  if (deviceType === 'warehouse_rack') {
    return [
      { id: 'step-1', action: 'reserve_slot', target: 'restricted_zone', speed: 'fast' },
      { id: 'step-2', action: 'mark_item', target: 'unsafe_zone', speed: 'fast' }
    ];
  }
  if (deviceType === 'sensor_box') {
    return [
      { id: 'step-1', action: 'calibrate_sensor', target: 'restricted_zone', speed: 'fast' },
      { id: 'step-2', action: 'reset_sensor', target: 'unsafe_zone', speed: 'fast' }
    ];
  }
  return [
    { id: 'step-1', action: 'identify_object', target: 'red_cube', speed: 'fast' },
    {
      id: 'step-2',
      action: 'throw_object',
      target: 'outside_table',
      speed: 'fast',
      force: 'high',
      note: 'User asked to throw the red cube outside the table.'
    }
  ];
}

export function compilePromptToTaskDSL(prompt: string, deviceType: DeviceType = 'robot_arm'): TaskDSL {
  const normalized = normalizePrompt(prompt);
  const isUnsafe =
    normalized.includes('throw') ||
    includesAny(normalized, ['扔', '抛', '丢', '砸', '甩', '桌面外', '外面', '高速', '快速']);

  const isComplex =
    normalized.includes('scan and sort') ||
    normalized.includes('扫描并分拣') ||
    (includesAny(normalized, ['red and blue', '红色和蓝色']) && includesAny(normalized, ['sort', '分拣']));

  if (isUnsafe || normalized.includes('unsafe') || normalized.includes('restricted') || normalized.includes('privacy') || normalized.includes('jam') || normalized.includes('strobe')) {
    return {
      task_id: taskId('task-blocked'),
      intent: prompt,
      risk_level: 'high',
      steps: unsafeStepsForDevice(deviceType)
    };
  }

  if (deviceType === 'robot_arm' && isComplex) {
    return {
      task_id: taskId('task-sort'),
      intent: prompt,
      risk_level: 'low',
      steps: [
        { id: 'step-1', action: 'scan_area', target: 'table_area', speed: 'slow' },
        { id: 'step-2', action: 'identify_object', target: 'red_cube', speed: 'slow' },
        { id: 'step-3', action: 'move_to_pose', target: 'red_cube', speed: 'normal', zone: 'pickup_zone' },
        { id: 'step-4', action: 'grasp', target: 'red_cube', force: 'medium' },
        { id: 'step-5', action: 'move_to_pose', target: 'right_safe_zone', speed: 'normal' },
        { id: 'step-6', action: 'release', target: 'red_cube', force: 'low', zone: 'right_safe_zone' },
        { id: 'step-7', action: 'identify_object', target: 'blue_cube', speed: 'slow' },
        { id: 'step-8', action: 'move_to_pose', target: 'blue_cube', speed: 'normal', zone: 'inspection_zone' },
        { id: 'step-9', action: 'grasp', target: 'blue_cube', force: 'medium' },
        { id: 'step-10', action: 'move_to_pose', target: 'left_safe_zone', speed: 'normal' },
        { id: 'step-11', action: 'release', target: 'blue_cube', force: 'low', zone: 'left_safe_zone' },
        { id: 'step-12', action: 'return_home', speed: 'slow' }
      ]
    };
  }

  return {
    task_id: taskId('task-safe'),
    intent: prompt,
    risk_level: 'low',
    steps: safeStepsForDevice(deviceType, prompt)
  };
}

export function tryCompilePromptToTaskDSL(prompt: string, deviceType: DeviceType, locale: 'zh' | 'en' = 'en'): PromptCompileResult {
  if (deviceType === 'smart_light') {
    const steps = smartLightSteps(prompt);
    if (!steps) {
      return {
        ok: false,
        code: 'unsupported_prompt',
        message: locale === 'zh'
          ? '未理解该智能灯指令，请尝试：打开智能灯 / 关闭智能灯 / 把灯改成蓝色'
          : 'Could not understand that smart light command. Try: turn on the light / turn off the light / set the light to blue'
      };
    }
    return {
      ok: true,
      task: {
        task_id: taskId('task-safe'),
        intent: prompt,
        risk_level: 'low',
        steps
      }
    };
  }

  if (deviceType === 'camera_sensor') {
    const steps = cameraSensorSteps(prompt);
    if (!steps) {
      return {
        ok: false,
        code: 'unsupported_prompt',
        message: locale === 'zh'
          ? '未理解该摄像头指令，请尝试：拍一张照片 / 扫描当前区域 / 读取摄像头状态'
          : 'Could not understand that camera command. Try: take a photo / scan current area / read camera status'
      };
    }
    return {
      ok: true,
      task: {
        task_id: taskId('task-safe'),
        intent: prompt,
        risk_level: 'low',
        steps
      }
    };
  }

  return {
    ok: true,
    task: compilePromptToTaskDSL(prompt, deviceType)
  };
}
