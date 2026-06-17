const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');

const root = path.resolve(__dirname, '..', '..');
const virtualProfileIds = [
  'virtual-robot-arm',
  'virtual-mobile-robot',
  'virtual-smart-light',
  'virtual-camera-sensor',
  'virtual-conveyor-belt'
];
const legacyProfileIds = ['generic-robot-arm', 'desktop-pick-place-arm', 'restricted-lab-arm'];

const capabilities = [
  'scan_area',
  'identify_object',
  'move_to_pose',
  'grasp',
  'release',
  'return_home',
  'navigate_to',
  'dock',
  'set_light',
  'set_brightness',
  'set_color',
  'capture_frame',
  'read_sensor',
  'start_belt',
  'stop_belt',
  'sort_item'
];

const DeviceMetaSchema = z.object({
  profile_id: z.string().min(1),
  profile_version: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().min(1),
  device_id: z.string().min(1),
  device_type: z.enum(['robot_arm', 'mobile_robot', 'smart_light', 'camera_sensor', 'conveyor_belt']),
  simulator_profile: z.enum([
    'robot_arm_semantic_v1',
    'mobile_robot_semantic_v1',
    'smart_light_semantic_v1',
    'camera_sensor_semantic_v1',
    'conveyor_belt_semantic_v1'
  ]),
  simulator_fidelity: z.object({
    level: z.enum(['semantic', 'kinematic', 'physics']),
    validates: z.array(z.string()).min(1),
    limitations: z.array(z.string())
  }).optional(),
  supported_adapters: z.array(z.string()).min(1),
  risk_class: z.enum(['low', 'medium', 'high']),
  display_name: z.string().min(1),
  model_asset: z.object({
    format: z.enum(['glb', 'gltf']),
    uri: z.string().min(1),
    source: z.enum(['real_device_cad', 'open_source_robot_model', 'generated_placeholder']),
    license: z.string().optional(),
    attribution: z.string().optional(),
    scale: z.number().positive().optional(),
    rotation: z.tuple([z.number(), z.number(), z.number()]).optional(),
    position: z.tuple([z.number(), z.number(), z.number()]).optional()
  }).optional(),
  capabilities: z.array(z.enum(capabilities)).min(1),
  constraints: z.object({
    workspace: z.object({
      x_min: z.number(),
      x_max: z.number(),
      y_min: z.number(),
      y_max: z.number(),
      z_min: z.number(),
      z_max: z.number()
    }),
    max_speed: z.enum(['slow', 'normal', 'fast']),
    force_limit: z.enum(['low', 'medium', 'high']),
    forbidden_zones: z.array(z.string()),
    known_targets: z.array(z.string()).optional()
  }),
  safety_profile: z.object({
    allow_throwing: z.boolean(),
    allow_high_force: z.boolean(),
    allow_outside_workspace: z.boolean(),
    medium_risk_requires_confirmation: z.boolean().optional(),
    block_medium_risk: z.boolean().optional(),
    require_logging: z.boolean(),
    require_human_confirmation_for_risky_actions: z.boolean()
  }),
  runtime_state: z.object({
    status: z.enum(['idle', 'executing', 'blocked', 'completed']),
    current_position: z.string()
  })
});

const vector3 = z.tuple([z.number(), z.number(), z.number()]);
const GeometrySchema = z.object({
  table: z.object({ width: z.number().positive(), depth: z.number().positive(), height: z.number().positive() }),
  robot: z.object({
    base_position: vector3,
    arm_segments: z.tuple([z.number().positive(), z.number().positive()]),
    gripper_size: z.number().positive()
  }),
  objects: z.object({
    red_cube: z.object({ position: vector3, size: z.number().positive() }),
    blue_cube: z.object({ position: vector3, size: z.number().positive() }),
    glass_cup: z.object({ position: vector3, radius: z.number().positive(), height: z.number().positive() })
  }),
  zones: z.record(z.object({ position: vector3, size: z.tuple([z.number().positive(), z.number().positive()]) })),
  workspace: z.object({
    x_min: z.number(),
    x_max: z.number(),
    y_min: z.number(),
    y_max: z.number(),
    z_min: z.number(),
    z_max: z.number()
  }),
  camera: z.object({ position: vector3, target: vector3 }),
  stage: z.object({
    layout: z.string(),
    nodes: z.record(z.object({ position: vector3, label: z.string().optional() })).optional(),
    indicators: z.record(z.string()).optional()
  }).optional()
});

const ScenarioSchema = z.object({
  id: z.string().min(1),
  device_profile: z.string().min(1),
  device_type: z.enum(['robot_arm', 'mobile_robot', 'smart_light', 'camera_sensor', 'conveyor_belt']),
  mode: z.enum(['safe', 'unsafe']),
  initial_state: z.record(z.unknown()),
  prompt: z.string().min(1),
  expected_task_type: z.string().min(1),
  unsafe_actions: z.array(z.string()),
  expected_safety_result: z.enum(['pass', 'blocked']),
  expected_state_after: z.record(z.unknown())
});

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const adapterInterface = fs.readFileSync(path.join(root, 'lib/adapter/AdapterInterface.ts'), 'utf8');
  const realAdapter = fs.readFileSync(path.join(root, 'lib/adapter/RealDeviceAdapter.ts'), 'utf8');
  const simulatorAdapter = fs.readFileSync(path.join(root, 'lib/virtual-lab/SimulatorAdapter.ts'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
  const labConfigurator = fs.readFileSync(path.join(root, 'components/LabConfigurator.tsx'), 'utf8');
  const auditPanel = fs.readFileSync(path.join(root, 'components/AuditPanel.tsx'), 'utf8');
  const exportBundle = fs.readFileSync(path.join(root, 'lib/export/exportRunBundle.ts'), 'utf8');
  const uiSource = `${page}\n${labConfigurator}\n${auditPanel}`;

  for (const method of ['connect', 'disconnect', 'getDeviceMeta', 'executeCommand', 'getState', 'stop', 'emergencyStop']) {
    assert(adapterInterface.includes(`${method}(`), `AdapterInterface missing ${method}().`);
    assert(realAdapter.includes(`${method}(`), `RealDeviceAdapter missing ${method}().`);
    assert(simulatorAdapter.includes(`${method}(`), `SimulatorAdapter missing ${method}().`);
  }

  for (const profileId of [...virtualProfileIds, ...legacyProfileIds]) {
    const profileDir = `profiles/${profileId}`;
    const meta = DeviceMetaSchema.parse(readJson(`${profileDir}/device.meta.json`));
    GeometrySchema.parse(readJson(`${profileDir}/geometry.json`));
    assert(fs.existsSync(path.join(root, profileDir, 'safety.rules.ts')), `${profileId} safety.rules.ts must exist.`);
    if (profileId.startsWith('virtual-')) {
      assert(meta.simulator_fidelity, `${profileId} must declare simulator_fidelity.`);
      assert(meta.simulator_fidelity.validates.includes('adapter_commands'), `${profileId} fidelity must validate adapter commands.`);
      assert(meta.simulator_fidelity.validates.includes('state_transition'), `${profileId} fidelity must validate state transitions.`);
      assert(meta.model_asset, `${profileId} must declare a GLB/GLTF model asset.`);
      assert(meta.model_asset.format === 'glb', `${profileId} model asset must be GLB for desktop runtime.`);
      assert(fs.existsSync(path.join(root, 'public', meta.model_asset.uri.replace(/^\//, ''))), `${profileId} model asset must exist: ${meta.model_asset.uri}`);
    }
  }

  const scenarioFiles = fs.readdirSync(path.join(root, 'scenarios')).filter((file) => file.endsWith('.json'));
  const scenarios = scenarioFiles.map((file) => ScenarioSchema.parse(readJson(`scenarios/${file}`)));
  for (const profileId of virtualProfileIds) {
    assert(scenarios.some((scenario) => scenario.device_profile === profileId && scenario.mode === 'safe'), `${profileId} missing safe scenario.`);
    assert(scenarios.some((scenario) => scenario.device_profile === profileId && scenario.mode === 'unsafe'), `${profileId} missing unsafe scenario.`);
  }

  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert(readme.includes('No hardware required'), 'README must state No hardware required.');
  assert(readme.includes('Same protocol for simulation and future real devices'), 'README must state shared simulation/future real-device protocol.');
  assert(readme.indexOf('No hardware required') < readme.indexOf('Future Real Device Adapter Boundary'), 'README must lead with Virtual Lab before real-device boundary.');
  assert(!uiSource.includes('Run on Real Device'), 'Main UI must not expose Real Device execution as a primary path.');
  assert(uiSource.includes('Developer Preview'), 'UI must keep real-device boundary in Developer Preview only.');
  assert(uiSource.includes('Not for production hardware'), 'Developer Preview must include a safety notice.');
  assert(page.includes('open_reality_lab_workspace'), 'Main UI must support saving/loading lab workspace files.');
  assert(page.includes('open_reality_adapter_execution_package'), 'Main UI must export adapter execution packages.');
  assert(page.includes('adapter_target_id'), 'Adapter execution packages must include per-device adapter target IDs.');
  assert(page.includes('workspace_devices'), 'Adapter execution packages must include workspace device configuration.');
  assert(page.includes('deployment_readiness'), 'Adapter execution packages must include deployment readiness results.');
  assert(page.includes('deployment_certificate'), 'Adapter execution packages must include a virtual-lab validation certificate.');
  assert(page.includes('package_digest_sha256'), 'Adapter execution packages must include a SHA-256 digest.');
  assert(page.includes('workspace_validation'), 'Adapter execution packages must include workspace-level validation results.');
  assert(page.includes('WorkspaceValidationResult'), 'Main UI must track workspace-level validation state.');
  assert(page.includes('localStorage'), 'Desktop workspace must autosave and restore lab files locally.');
  assert(page.includes('Restore Last'), 'Desktop workspace must expose restoring the last autosaved workspace.');
  assert(page.includes('getWorkspaceIssues'), 'Main UI must run workspace preflight checks.');
  assert(page.includes('OperatorNotice'), 'Main UI must provide visible operator feedback for user actions.');
  assert(page.includes('showNotice'), 'Main UI must surface run/open/export failures instead of failing silently.');
  assert(auditPanel.includes('DeviceInspector'), 'Audit panel must include a selected-device inspector.');
  assert(auditPanel.includes('onWorkspaceDeviceChange'), 'Device inspector must edit workspace device deployment configuration.');
  assert(auditPanel.includes('forbidden_zones'), 'Device inspector must expose editable forbidden zones.');
  assert(!exportBundle.includes('MVP'), 'Export bundle product naming must not use MVP/demo language.');

  console.log('Conformance checks passed.');
  console.log('- Five virtual device profiles are valid.');
  console.log('- Legacy robot-arm profiles remain schema-compatible.');
  console.log('- Every virtual profile has safe and unsafe scenarios.');
  console.log('- Every virtual profile declares simulator fidelity and validation scope.');
  console.log('- Every virtual profile binds to an existing GLB device model asset.');
  console.log('- SimulatorAdapter and RealDeviceAdapter share AdapterInterface.');
  console.log('- Main UI centers Virtual Lab and does not expose Real Device execution.');
  console.log('- README states No hardware required before future real-device boundary.');
  console.log('- Desktop workspace supports lab files, adapter packages, device inspection, deployment config editing, preflight checks, workspace validation, autosave, export digests, and operator feedback.');
}

main();
