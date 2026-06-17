import type { DeviceType } from '@/types/deviceMeta';

export type Locale = 'zh' | 'en';

const copy = {
  en: {
    app_project: 'Project',
    app_new: 'New',
    app_open: 'Open',
    app_import_asset: 'Import Asset',
    app_save_project: 'Save Project',
    app_save_as: 'Save As',
    app_restore: 'Restore',
    app_run: 'Run',
    app_stop: 'Stop',
    app_export_report: 'Export Report',
    app_export_adapter_package: 'Export Adapter Package',
    status_idle: 'Idle',
    status_executed: 'Executed',
    status_playing_motion: 'Playing Motion',
    status_safety_blocked: 'Safety Blocked',
    command_waiting: 'Waiting for AI command.',
    command_running: 'Compiling AI command and running simulation.',
    command_stopped: 'Run stopped.',
    command_ready: 'Ready',
    command_completed: 'Completed',
    command_blocked: 'Blocked',
    command_ask_human: 'Ask Human',
    command_proposed: 'Proposed',
    command_coming_soon: 'Coming Soon',
    command_failed: 'Failed',
    coming_soon_runtime: 'is not runnable in v0.1. Only robot_arm, smart_light, and camera_sensor support simulation run right now.',
    coming_soon_scenario: 'scenarios are not implemented. v0.1 only supports simulation run for robot_arm, smart_light, and camera_sensor.',
    prompt_placeholder: 'Describe the device task. Enter to run, Shift+Enter for newline, Ctrl+Enter to run.',
    replay: 'Replay',
    adapter_commands: 'Adapter Commands',
    state_diff: 'State Diff',
    logs: 'Logs',
    current_playback: 'Current Playback',
    pause: 'Pause',
    play: 'Play',
    step_prev: 'Step Prev',
    step_next: 'Step Next',
    reset: 'Reset',
    slow_mode: 'Slow Mode',
    command: 'Command',
    frame: 'Frame',
    time: 'Time',
    waiting_run: 'Waiting for run. Select a scenario and click Run.',
    no_commands_generated: 'No commands generated yet.',
    waiting_state_changes: 'Waiting for state changes.',
    ai_command: 'AI Command',
    running: 'Running',
    validate: 'Validate',
    developer_preview: 'Developer Preview',
    not_for_production: 'Not for production hardware',
    devices: 'Devices',
    language: 'Language',
    chinese: '中文',
    english: 'English',
    device_type: 'Device Type',
    device_profile: 'Device Profile',
    scenario: 'Validation Scenario',
    scenario_not_implemented: 'Scenario not implemented',
    asset_library: 'Industrial Device Library',
    search_assets: 'Search assets...',
    no_assets_found: 'No assets found',
    sim: 'SIM',
    risk: 'RISK',
    license: 'LICENSE',
    add: 'Add',
    device: 'Device',
    model: 'Model',
    asset: 'Asset',
    run_status: 'Run Status',
    adapter: 'Adapter',
    fidelity: 'Fidelity',
    simulator_adapter_short: 'Sim',
    perspective_grid_snap: '[ Perspective | Grid: 0.1m | Snap: ON ]',
    action_plan_preview: 'Action Plan Preview',
    blocked_by_safety_runtime: 'Blocked by Safety Runtime',
    safety_runtime_blocked_caps: '[ SAFETY RUNTIME BLOCKED ]',
    snapshot: 'Snapshot',
    inspector_overview: 'Overview',
    inspector_runtime_state: 'Runtime State',
    inspector_capabilities: 'Capabilities',
    inspector_safety_rules: 'Safety Rules',
    inspector_geometry: 'Geometry',
    inspector_adapter_manifest: 'Adapter Manifest',
    inspector_asset_license: 'Asset License',
    runnable: 'Runnable',
    not_runnable: 'Coming Soon',
    not_run: 'Not run',
    duplicate_device: 'Duplicate Device',
    export_asset_config: 'Export Asset Config',
    remove_device: 'Remove Device'
  },
  zh: {
    app_project: '项目',
    app_new: '新建',
    app_open: '打开',
    app_import_asset: '导入资产',
    app_save_project: '保存工程',
    app_save_as: '另存为',
    app_restore: '恢复',
    app_run: '运行',
    app_stop: '停止',
    app_export_report: '导出报告',
    app_export_adapter_package: '导出适配器配置包',
    status_idle: '待运行',
    status_executed: '已执行',
    status_playing_motion: '动作播放中',
    status_safety_blocked: '安全拦截',
    command_waiting: '等待 AI 指令。',
    command_running: '正在编译 AI 指令并执行仿真。',
    command_stopped: '执行已停止。',
    command_ready: '待运行',
    command_completed: '已完成',
    command_blocked: '已阻止',
    command_ask_human: '需要确认',
    command_proposed: '计划待确认',
    command_coming_soon: '暂未实现',
    command_failed: '失败',
    coming_soon_runtime: '暂未接入 v0.1 运行链路。当前仅支持 robot_arm、smart_light、camera_sensor 的 simulation run。',
    coming_soon_scenario: '场景未实现。v0.1 仅支持 robot_arm、smart_light、camera_sensor 的 simulation run。',
    prompt_placeholder: '输入要让设备完成的任务。Enter 运行，Shift+Enter 换行，Ctrl+Enter 运行。',
    replay: '回放',
    adapter_commands: '适配器命令',
    state_diff: '状态差异',
    logs: '日志',
    current_playback: '当前回放',
    pause: '暂停',
    play: '播放',
    step_prev: '上一步',
    step_next: '下一步',
    reset: '重置',
    slow_mode: '慢速模式',
    command: '命令',
    frame: '帧',
    time: '时间',
    waiting_run: '等待运行。选择场景后点击运行。',
    no_commands_generated: '尚未生成命令。',
    waiting_state_changes: '等待设备状态变化。',
    ai_command: 'AI 指令',
    running: '运行中',
    validate: '验证',
    developer_preview: '开发者预览',
    not_for_production: '不用于生产硬件',
    devices: '设备',
    language: '语言',
    chinese: '中文',
    english: 'English',
    device_type: '设备类型',
    device_profile: '设备档案',
    scenario: '验证场景',
    scenario_not_implemented: '场景未实现',
    asset_library: '工业设备库',
    search_assets: '搜索资产...',
    no_assets_found: '未找到资产',
    sim: '仿真',
    risk: '风险',
    license: '许可',
    add: '添加',
    device: '设备',
    model: '型号',
    asset: '资产',
    run_status: '运行状态',
    adapter: '适配器',
    fidelity: '仿真级别',
    simulator_adapter_short: '仿真',
    perspective_grid_snap: '[ 透视 | 网格: 0.1m | 吸附: 开 ]',
    action_plan_preview: '动作计划预览',
    blocked_by_safety_runtime: '已被安全运行时拦截',
    safety_runtime_blocked_caps: '[ 安全运行时已拦截 ]',
    snapshot: '快照',
    inspector_overview: '概览',
    inspector_runtime_state: '运行状态',
    inspector_capabilities: '能力',
    inspector_safety_rules: '安全规则',
    inspector_geometry: '几何信息',
    inspector_adapter_manifest: '适配器清单',
    inspector_asset_license: '资产许可',
    runnable: '可运行',
    not_runnable: '暂未实现',
    not_run: '未运行',
    duplicate_device: '复制设备',
    export_asset_config: '导出资产配置',
    remove_device: '移除设备'
  }
} as const;

type CopyKey = keyof typeof copy.en;

const deviceTypeMap: Record<DeviceType, { zh: string; en: string }> = {
  robot_arm: { zh: '机械臂', en: 'Robot Arm' },
  mobile_robot: { zh: '移动机器人', en: 'Mobile Robot' },
  smart_light: { zh: '智能灯', en: 'Smart Light' },
  camera_sensor: { zh: '摄像头传感器', en: 'Camera Sensor' },
  conveyor_belt: { zh: '传送带', en: 'Conveyor Belt' },
  plc_cabinet: { zh: 'PLC 控制柜', en: 'PLC Cabinet' },
  lab_instrument: { zh: '实验室仪器', en: 'Lab Instrument' },
  warehouse_rack: { zh: '仓储货架', en: 'Warehouse Rack' },
  sensor_box: { zh: '传感器盒', en: 'Sensor Box' }
};

const statusMap: Record<string, { zh: string; en: string }> = {
  idle: { zh: '待机', en: 'IDLE' },
  pass: { zh: '通过', en: 'PASS' },
  blocked: { zh: '已拦截', en: 'BLOCKED' },
  needs_confirmation: { zh: '需确认', en: 'REVIEW' },
  executing: { zh: '执行中', en: 'RUNNING' },
  completed: { zh: '完成', en: 'DONE' },
  failed: { zh: '失败', en: 'FAILED' },
  running: { zh: '运行中', en: 'RUNNING' },
  captured: { zh: '已采集', en: 'CAPTURED' },
  sampled: { zh: '已读取', en: 'SAMPLED' },
  on: { zh: '开启', en: 'ON' },
  off: { zh: '关闭', en: 'OFF' }
};

const displayNameMap: Record<string, { zh: string; en: string }> = {
  'Generic Industrial Robot Arm': { zh: '通用工业机械臂', en: 'Generic Industrial Robot Arm' },
  '通用工业机械臂': { zh: '通用工业机械臂', en: 'Generic Industrial Robot Arm' },
  'Generic Smart Light Panel': { zh: '通用智能灯', en: 'Generic Smart Light Panel' },
  '通用智能灯': { zh: '通用智能灯', en: 'Generic Smart Light Panel' },
  'Generic PTZ Camera': { zh: '通用云台摄像头', en: 'Generic PTZ Camera' },
  '通用云台摄像头': { zh: '通用云台摄像头', en: 'Generic PTZ Camera' },
  'Generic AGV Mobile Robot': { zh: '通用 AGV 移动机器人', en: 'Generic AGV Mobile Robot' },
  '通用 AGV 移动机器人': { zh: '通用 AGV 移动机器人', en: 'Generic AGV Mobile Robot' },
  'Generic Conveyor Belt': { zh: '通用传送带', en: 'Generic Conveyor Belt' },
  '通用传送带': { zh: '通用传送带', en: 'Generic Conveyor Belt' },
  'Generic PLC Cabinet': { zh: '通用 PLC 控制柜', en: 'Generic PLC Cabinet' },
  '通用 PLC 控制柜': { zh: '通用 PLC 控制柜', en: 'Generic PLC Cabinet' },
  'Generic Lab Instrument': { zh: '通用实验室仪器', en: 'Generic Lab Instrument' },
  '通用实验室仪器': { zh: '通用实验室仪器', en: 'Generic Lab Instrument' },
  'Generic Warehouse Rack': { zh: '通用仓储货架', en: 'Generic Warehouse Rack' },
  '通用仓储货架': { zh: '通用仓储货架', en: 'Generic Warehouse Rack' },
  'Generic Sensor Box': { zh: '通用传感器盒', en: 'Generic Sensor Box' },
  '通用传感器盒': { zh: '通用传感器盒', en: 'Generic Sensor Box' },
  'Camera Sensor': { zh: '摄像头传感器', en: 'Camera Sensor' },
  '摄像头传感器': { zh: '摄像头传感器', en: 'Camera Sensor' },
  'Virtual Robot Arm': { zh: '虚拟机械臂', en: 'Virtual Robot Arm' },
  '虚拟机械臂': { zh: '虚拟机械臂', en: 'Virtual Robot Arm' },
  'Virtual Smart Light': { zh: '虚拟智能灯', en: 'Virtual Smart Light' },
  '虚拟智能灯': { zh: '虚拟智能灯', en: 'Virtual Smart Light' },
  'Virtual Camera Sensor': { zh: '虚拟摄像头传感器', en: 'Virtual Camera Sensor' },
  '虚拟摄像头传感器': { zh: '虚拟摄像头传感器', en: 'Virtual Camera Sensor' },
  'Robot Arm Safe Pick and Place': { zh: '机械臂安全抓取放置', en: 'Robot Arm Safe Pick and Place' },
  '机械臂安全抓取放置': { zh: '机械臂安全抓取放置', en: 'Robot Arm Safe Pick and Place' },
  'Robot Arm Unsafe Throw Block': { zh: '机械臂危险抛掷拦截', en: 'Robot Arm Unsafe Throw Block' },
  '机械臂危险抛掷拦截': { zh: '机械臂危险抛掷拦截', en: 'Robot Arm Unsafe Throw Block' },
  'Smart Light Control': { zh: '智能灯控制', en: 'Smart Light Control' },
  '智能灯控制': { zh: '智能灯控制', en: 'Smart Light Control' },
  'Camera Safe Capture': { zh: '摄像头安全采集', en: 'Camera Safe Capture' },
  '摄像头安全采集': { zh: '摄像头安全采集', en: 'Camera Safe Capture' },
  'Camera Privacy Zone Block': { zh: '摄像头隐私区拦截', en: 'Camera Privacy Zone Block' },
  '摄像头隐私区拦截': { zh: '摄像头隐私区拦截', en: 'Camera Privacy Zone Block' },
  'robot-arm-pick-place-safe': { zh: '机械臂安全抓取放置', en: 'Robot Arm Safe Pick and Place' },
  'robot-arm-pick-place-unsafe': { zh: '机械臂危险抛掷拦截', en: 'Robot Arm Unsafe Throw Block' },
  'smart-light-control-safe': { zh: '智能灯控制', en: 'Smart Light Control' },
  'smart-light-control-unsafe': { zh: '智能灯高风险操作拦截', en: 'Smart Light Unsafe Operation Block' },
  'camera-sensor-check-safe': { zh: '摄像头安全采集', en: 'Camera Safe Capture' },
  'camera-sensor-check-unsafe': { zh: '摄像头隐私区拦截', en: 'Camera Privacy Zone Block' },
  'virtual-robot-arm': { zh: '通用机械臂', en: 'Robot Arm' },
  'virtual-mobile-robot': { zh: '移动机器人', en: 'Mobile Robot' },
  'virtual-smart-light': { zh: '智能灯', en: 'Smart Light' },
  'virtual-camera-sensor': { zh: '摄像头传感器', en: 'Camera Sensor' },
  'virtual-conveyor-belt': { zh: '传送带', en: 'Conveyor Belt' }
};

const categoryMap: Record<string, { zh: string; en: string }> = {
  robotics: { zh: '机器人', en: 'Robotics' },
  vision: { zh: '视觉', en: 'Vision' },
  semantic: { zh: '语义级', en: 'Semantic' },
  factory: { zh: '工厂', en: 'Factory' },
  automation: { zh: '自动化', en: 'Automation' },
  sensor: { zh: '传感器', en: 'Sensor' },
  sensors: { zh: '传感器', en: 'Sensors' },
  warehouse: { zh: '仓储', en: 'Warehouse' },
  lab: { zh: '实验室', en: 'Lab' },
  controls: { zh: '控制', en: 'Controls' },
  'mobile-robotics': { zh: '移动机器人', en: 'Mobile Robotics' },
  'building-automation': { zh: '楼宇自动化', en: 'Building Automation' },
  'material-handling': { zh: '物流输送', en: 'Material Handling' },
  'lab-equipment': { zh: '实验设备', en: 'Lab Equipment' }
};

const fidelityMap: Record<string, { zh: string; en: string }> = {
  semantic: { zh: '语义级', en: 'Semantic' },
  kinematic: { zh: '运动学级', en: 'Kinematic' },
  physics: { zh: '物理级', en: 'Physics' }
};

const capabilityMap: Record<string, { zh: string; en: string }> = {
  'robot.pick': { zh: '机械臂抓取', en: 'Robot Pick' },
  'robot.place': { zh: '机械臂放置', en: 'Robot Place' },
  'robot.move_to_pose': { zh: '机械臂移动到位姿', en: 'Robot Move To Pose' },
  'robot.return_home': { zh: '机械臂回原点', en: 'Robot Return Home' },
  'light.set_power': { zh: '灯光电源控制', en: 'Light Power Control' },
  'light.set_brightness': { zh: '灯光亮度控制', en: 'Light Brightness Control' },
  'light.set_color': { zh: '灯光颜色控制', en: 'Light Color Control' },
  'camera.snapshot': { zh: '拍摄快照', en: 'Camera Snapshot' },
  'sensor.read': { zh: '读取传感器', en: 'Sensor Read' },
  'device.read_state': { zh: '读取设备状态', en: 'Device Read State' },
  'device.dry_run': { zh: '设备干运行', en: 'Device Dry Run' },
  'device.emergency_stop': { zh: '设备急停', en: 'Device Emergency Stop' },
  scan_area: { zh: '扫描区域', en: 'Scan Area' },
  identify_object: { zh: '识别目标', en: 'Identify Object' },
  move_to_pose: { zh: '移动到位姿', en: 'Move To Pose' },
  grasp: { zh: '抓取', en: 'Grasp' },
  release: { zh: '释放', en: 'Release' },
  return_home: { zh: '回到原点', en: 'Return Home' },
  set_light: { zh: '设置灯光', en: 'Set Light' },
  set_brightness: { zh: '设置亮度', en: 'Set Brightness' },
  set_color: { zh: '设置颜色', en: 'Set Color' },
  capture_frame: { zh: '采集画面', en: 'Capture Frame' },
  read_sensor: { zh: '读取传感器', en: 'Read Sensor' }
};

const metadataValueMap: Record<string, { zh: string; en: string }> = {
  low: { zh: '低', en: 'Low' },
  medium: { zh: '中', en: 'Medium' },
  high: { zh: '高', en: 'High' },
  slow: { zh: '慢速', en: 'Slow' },
  normal: { zh: '常速', en: 'Normal' },
  fast: { zh: '快速', en: 'Fast' },
  idle: { zh: '待机', en: 'Idle' },
  completed: { zh: '完成', en: 'Completed' },
  blocked: { zh: '已拦截', en: 'Blocked' },
  docked: { zh: '已停靠', en: 'Docked' },
  captured: { zh: '已采集', en: 'Captured' },
  pickup_zone: { zh: '取料区', en: 'Pickup Zone' },
  right_safe_zone: { zh: '右侧安全区', en: 'Right Safe Zone' },
  left_safe_zone: { zh: '左侧安全区', en: 'Left Safe Zone' },
  front_safe_zone: { zh: '前侧安全区', en: 'Front Safe Zone' },
  back_safe_zone: { zh: '后侧安全区', en: 'Back Safe Zone' },
  charging_dock: { zh: '充电桩', en: 'Charging Dock' },
  aisle_a: { zh: 'A 通道', en: 'Aisle A' },
  restricted_zone: { zh: '限制区', en: 'Restricted Zone' },
  unsafe_zone: { zh: '危险区', en: 'Unsafe Zone' },
  privacy_zone: { zh: '隐私区', en: 'Privacy Zone' },
  bin_a: { zh: 'A 料箱', en: 'Bin A' },
  jam_zone: { zh: '卡滞区', en: 'Jam Zone' },
  red_cube: { zh: '红色方块', en: 'Red Cube' },
  blue_cube: { zh: '蓝色方块', en: 'Blue Cube' },
  lamp: { zh: '灯具', en: 'Lamp' },
  camera_view: { zh: '摄像头视野', en: 'Camera View' },
  generic: { zh: '通用', en: 'Generic' },
  'project-owned-generic': { zh: '项目自有通用许可', en: 'Project-Owned Generic' },
  'created-for-open-reality-studio': { zh: '为 Open Reality Studio 创建', en: 'Created for Open Reality Studio' },
  generated_placeholder: { zh: '占位资产', en: 'Placeholder Asset' },
  open_source_robot_model: { zh: '开源设备模型', en: 'Open Source Device Model' },
  real_device_cad: { zh: '真实设备 CAD', en: 'Real Device CAD' }
};

const messageMap: Record<string, { zh: string; en: string }> = {
  'Blocked by Safety Runtime': { zh: '已被安全运行时拦截', en: 'Blocked by Safety Runtime' },
  'Run stopped.': { zh: '执行已停止。', en: 'Run stopped.' },
  'Execution completed.': { zh: '执行完成。', en: 'Execution completed.' },
  'Waiting for AI command.': { zh: '等待 AI 指令。', en: 'Waiting for AI command.' }
};

export function t(locale: Locale, key: CopyKey | string) {
  const table = copy[locale] as Record<string, string>;
  return table[key] ?? copy.en[key as CopyKey] ?? key;
}

export function localizeStatus(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return statusMap[normalized]?.[locale] ?? statusMap[normalized]?.en ?? normalized;
}

export function localizeDeviceType(locale: Locale, value: unknown) {
  const normalized = String(value ?? '') as DeviceType;
  return deviceTypeMap[normalized]?.[locale] ?? deviceTypeMap[normalized]?.en ?? String(value ?? '');
}

function localizeNumberedDeviceName(locale: Locale, value: string) {
  for (const entry of Object.values(deviceTypeMap)) {
    const labels = [entry.zh, entry.en];
    for (const label of labels) {
      if (value === label) return entry[locale];
      if (value.startsWith(`${label} `)) {
        return `${entry[locale]} ${value.slice(label.length + 1)}`;
      }
    }
  }
  return null;
}

export function localizeDisplayName(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  const numbered = localizeNumberedDeviceName(locale, normalized);
  if (numbered) return numbered;
  if (displayNameMap[normalized]) return displayNameMap[normalized][locale];
  if (normalized in deviceTypeMap) return localizeDeviceType(locale, normalized);
  return normalized;
}

export function localizeCategory(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return categoryMap[normalized]?.[locale] ?? categoryMap[normalized]?.en ?? normalized;
}

export function localizeCapability(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return capabilityMap[normalized]?.[locale] ?? capabilityMap[normalized]?.en ?? normalized;
}

export function localizeProfileName(locale: Locale, value: unknown) {
  return localizeDisplayName(locale, value);
}

export function localizeScenarioName(locale: Locale, value: unknown) {
  return localizeDisplayName(locale, value);
}

export function localizeFidelity(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return fidelityMap[normalized]?.[locale] ?? fidelityMap[normalized]?.en ?? normalized;
}

export function localizeMetadataValue(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return (
    metadataValueMap[normalized]?.[locale]
    ?? metadataValueMap[normalized]?.en
    ?? categoryMap[normalized]?.[locale]
    ?? categoryMap[normalized]?.en
    ?? normalized
  );
}

export function localizeMessage(locale: Locale, value: unknown) {
  const normalized = String(value ?? '');
  return messageMap[normalized]?.[locale] ?? messageMap[normalized]?.en ?? normalized;
}
