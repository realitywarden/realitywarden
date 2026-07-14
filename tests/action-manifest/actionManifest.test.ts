/**
 * Action Manifest behavioral tests (no hardware, no Ollama).
 * Release gate: the cooperating-malicious manifest suite — every manifest
 * that tries to loosen an envelope, use undeclared primitives/targets, or
 * shadow a built-in must be rejected with an explicit code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateActionManifest, expandManifestToTaskDsl } from '../../lib/action-manifest/ActionManifest';
import { exportActionLibrary, importActionLibrary } from '../../lib/action-manifest/ActionLibrary';
import { createAdapterCommand } from '../../lib/adapter/AdapterCommandCompiler';
import { SmartLightActionModel } from '../../lib/action-runtime/models/SmartLightActionModel';
import { CameraSensorActionModel } from '../../lib/action-runtime/models/CameraSensorActionModel';
import { runSafetyRuntime } from '../../lib/safety/SafetyRuntime';
import type { DeviceGeometry, DeviceMeta } from '../../types/deviceMeta';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

function resolveRepoFile(relative: string): string {
  const fromDirname = path.resolve(__dirname, '..', '..', relative);
  if (fs.existsSync(fromDirname)) return fromDirname;
  return path.resolve(process.cwd(), relative);
}

const robotArmMeta = JSON.parse(
  fs.readFileSync(resolveRepoFile(path.join('profiles', 'virtual-robot-arm', 'device.meta.json')), 'utf8')
) as DeviceMeta;

function readJson<T>(relative: string): T {
  return JSON.parse(fs.readFileSync(resolveRepoFile(relative), 'utf8')) as T;
}

const referenceRecipes = [
  {
    name: 'robot arm',
    profile: 'virtual-robot-arm',
    recipe: 'scan_left_to_right.json'
  },
  {
    name: 'smart light',
    profile: 'virtual-smart-light',
    recipe: 'focus_work_light.json'
  },
  {
    name: 'camera sensor',
    profile: 'virtual-camera-sensor',
    recipe: 'inspect_then_capture.json'
  }
] as const;

const BUILTINS = new Set(['move_object', 'return_home', 'inspect', 'throw_object', 'organize_workspace']);

function goodManifest() {
  return {
    manifest_version: 1,
    action_id: 'scan_left_to_right',
    display_name: { zh: '从左到右扫描', en: 'Scan left to right' },
    device_type: 'robot_arm',
    safety: {
      declared_risk: 'low',
      required_sensors: [],
      envelope: { max_speed: 'normal', max_force: 'low' }
    },
    steps: [
      { action: 'move_to_pose', target: 'left_safe_zone', speed: 'slow' },
      { action: 'move_to_pose', target: 'right_safe_zone', speed: 'slow' },
      { action: 'return_home' }
    ]
  };
}

const tests: Array<[string, () => void]> = [
  ['valid manifest passes and expands to primitives', () => {
    const result = validateActionManifest(goodManifest(), robotArmMeta, BUILTINS);
    assert(result.ok, 'valid manifest must validate');
    const expanded = expandManifestToTaskDsl(result.manifest, robotArmMeta, 'scan please');
    assert(expanded.ok, 'valid manifest must expand');
    assert(expanded.taskDsl.steps.length === 3, 'all steps expand');
    assert(expanded.taskDsl.risk_level === 'low', 'risk recomputed low for safe steps');
  }],
  ['declared_risk gets zero weight', () => {
    const manifest = goodManifest();
    manifest.safety.declared_risk = 'high'; // lies loudly
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(result.ok, 'declared risk does not fail validation');
    const expanded = expandManifestToTaskDsl(result.manifest, robotArmMeta, 'scan');
    assert(expanded.ok && expanded.taskDsl.risk_level === 'low', 'risk recomputed by rules, declaration discarded');
  }],
  ['MALICIOUS: unknown primitive rejected', () => {
    const manifest = goodManifest();
    (manifest.steps as Array<Record<string, unknown>>).push({ action: 'launch_rocket' });
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'unknown_primitive', `got ${JSON.stringify(result)}`);
  }],
  ['MALICIOUS: unknown target rejected', () => {
    const manifest = goodManifest();
    (manifest.steps as Array<Record<string, unknown>>)[0] = { action: 'move_to_pose', target: 'the_moon' };
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'unknown_target', `got ${JSON.stringify(result)}`);
  }],
  ['MALICIOUS: envelope looser than profile rejected, never clamped', () => {
    const manifest = goodManifest();
    manifest.safety.envelope = { max_speed: 'fast', max_force: 'high' }; // profile force_limit is medium
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'envelope_exceeds_profile', `got ${JSON.stringify(result)}`);
  }],
  ['MALICIOUS: step exceeding own envelope rejected at expansion', () => {
    const manifest = goodManifest();
    (manifest.steps as Array<Record<string, unknown>>)[0] = { action: 'move_to_pose', target: 'left_safe_zone', force: 'high' };
    const validated = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(validated.ok, 'validation checks manifest-level envelope only');
    const expanded = expandManifestToTaskDsl(validated.manifest, robotArmMeta, 'x');
    assert(!expanded.ok && expanded.code === 'envelope_exceeds_profile', `got ${JSON.stringify(expanded)}`);
  }],
  ['MALICIOUS: forbidden-zone target still reaches rules that block it', () => {
    // outside_table IS a known target (the pipeline must see it to block it):
    // expansion succeeds, and the recomputed risk is high — the downstream
    // safety layers (unchanged) block high-risk throw shapes as always.
    const manifest = goodManifest();
    (manifest.steps as Array<Record<string, unknown>>)[1] = { action: 'move_to_pose', target: 'outside_table' };
    const validated = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(validated.ok, 'known-but-forbidden target passes shape validation');
    const expanded = expandManifestToTaskDsl(validated.manifest, robotArmMeta, 'x');
    assert(expanded.ok && expanded.taskDsl.risk_level === 'high', 'forbidden zone recomputes to high risk');
  }],
  ['name collision with built-in rejected', () => {
    const manifest = goodManifest();
    manifest.action_id = 'return_home';
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'name_collision', `got ${JSON.stringify(result)}`);
  }],
  ['unknown fields rejected (.strict)', () => {
    const manifest = goodManifest() as Record<string, unknown>;
    manifest.autorun_on_boot = true;
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'schema_rejected', `got ${JSON.stringify(result)}`);
  }],
  ['missing safety block rejected (default-block)', () => {
    const manifest = goodManifest() as Record<string, unknown>;
    delete manifest.safety;
    const result = validateActionManifest(manifest, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'schema_rejected', `got ${JSON.stringify(result)}`);
  }],
  ['action library export/import round trip revalidates manifests', () => {
    const validated = validateActionManifest(goodManifest(), robotArmMeta, BUILTINS);
    assert(validated.ok, 'fixture validates before export');
    const imported = importActionLibrary(JSON.parse(exportActionLibrary([validated.manifest])), robotArmMeta, BUILTINS);
    assert(imported.ok && imported.actions.length === 1 && imported.actions[0].action_id === validated.manifest.action_id, 'round trip preserves validated action');
  }],
  ['MALICIOUS: library import is atomic when one action is invalid', () => {
    const bad = goodManifest();
    bad.safety.envelope = { max_speed: 'fast', max_force: 'high' };
    const imported = importActionLibrary({ format: 'realitywarden.action-library', version: 1, exported_at: new Date().toISOString(), actions: [goodManifest(), bad] }, robotArmMeta, BUILTINS);
    assert(!imported.ok && imported.code === 'invalid_action', `got ${JSON.stringify(imported)}`);
  }],
  ['duplicate library action ids rejected', () => {
    const imported = importActionLibrary({ format: 'realitywarden.action-library', version: 1, exported_at: new Date().toISOString(), actions: [goodManifest(), goodManifest()] }, robotArmMeta, BUILTINS);
    assert(!imported.ok && imported.code === 'duplicate_action', `got ${JSON.stringify(imported)}`);
  }],
  ['existing action ids never overwritten by import', () => {
    const imported = importActionLibrary({ format: 'realitywarden.action-library', version: 1, exported_at: new Date().toISOString(), actions: [goodManifest()] }, robotArmMeta, BUILTINS, new Set(['scan_left_to_right']));
    assert(!imported.ok && imported.code === 'existing_action', `got ${JSON.stringify(imported)}`);
  }],
  ['unknown action-library envelope fields rejected', () => {
    const imported = importActionLibrary({ format: 'realitywarden.action-library', version: 1, exported_at: new Date().toISOString(), actions: [goodManifest()], autorun: true }, robotArmMeta, BUILTINS);
    assert(!imported.ok && imported.code === 'invalid_library', `got ${JSON.stringify(imported)}`);
  }],
  ['three reference-device recipes validate, expand, pass safety, and execute semantically', () => {
    for (const fixture of referenceRecipes) {
      const meta = readJson<DeviceMeta>(path.join('profiles', fixture.profile, 'device.meta.json'));
      const geometry = readJson<DeviceGeometry>(path.join('profiles', fixture.profile, 'geometry.json'));
      const raw = readJson<unknown>(path.join('examples', 'action-manifests', fixture.recipe));
      const validated = validateActionManifest(raw, meta, BUILTINS);
      assert(validated.ok, `${fixture.name} reference recipe must validate: ${JSON.stringify(validated)}`);
      const expanded = expandManifestToTaskDsl(validated.manifest, meta, fixture.name);
      assert(expanded.ok, `${fixture.name} reference recipe must expand`);
      const safety = runSafetyRuntime(meta, expanded.taskDsl);
      assert(safety.status === 'pass', `${fixture.name} reference recipe must pass normal simulation safety: ${JSON.stringify(safety.blocked_reasons)}`);

      let state: Record<string, unknown> = { ...meta.runtime_state };
      const model = fixture.profile === 'virtual-smart-light'
        ? new SmartLightActionModel()
        : fixture.profile === 'virtual-camera-sensor'
          ? new CameraSensorActionModel()
          : null;
      for (const step of expanded.taskDsl.steps) {
        const command = createAdapterCommand(meta, step);
        assert(command.allowed, `${fixture.name} primitive ${step.action} must stay capability-declared`);
        if (model) {
          const plan = model.plan({ command, deviceMeta: meta, geometry, currentState: state });
          assert(!plan.validation.blocked, `${fixture.name} primitive ${step.action} must produce an executable semantic plan`);
          state = plan.end_state;
        }
      }
      if (fixture.profile === 'virtual-smart-light') {
        assert(state.brightness === 55 && state.color === 'warm_white', 'smart-light recipe must preserve typed brightness/color values through expansion and execution');
      }
      if (fixture.profile === 'virtual-camera-sensor') {
        assert(state.frames_captured === 1 && state.status === 'captured', 'camera recipe must execute inspect then capture semantics');
      }
    }
  }],
  ['reference recipes are profile-specific and cross-device import is rejected', () => {
    const lightRecipe = readJson<unknown>(path.join('examples', 'action-manifests', 'focus_work_light.json'));
    const result = validateActionManifest(lightRecipe, robotArmMeta, BUILTINS);
    assert(!result.ok && result.code === 'device_type_mismatch', `cross-device recipe must reject explicitly, got ${JSON.stringify(result)}`);
  }],
  ['untrusted primitive values require an explicit type and range policy', () => {
    const lightMeta = readJson<DeviceMeta>(path.join('profiles', 'virtual-smart-light', 'device.meta.json'));
    const base = readJson<Record<string, unknown>>(path.join('examples', 'action-manifests', 'focus_work_light.json'));
    const cases = [
      { action: 'set_light', target: 'lamp', speed: 'slow', value: 'true' },
      { action: 'set_brightness', target: 'lamp', speed: 'slow', value: 101 },
      { action: 'set_color', target: 'lamp', speed: 'slow', value: 'strobe' }
    ];
    for (const step of cases) {
      const result = validateActionManifest({ ...base, steps: [step] }, lightMeta, BUILTINS);
      assert(!result.ok && result.code === 'invalid_value', `invalid ${step.action} value must default-reject: ${JSON.stringify(result)}`);
    }

    const cameraMeta = readJson<DeviceMeta>(path.join('profiles', 'virtual-camera-sensor', 'device.meta.json'));
    const cameraBase = readJson<Record<string, unknown>>(path.join('examples', 'action-manifests', 'inspect_then_capture.json'));
    const undeclaredValue = validateActionManifest({
      ...cameraBase,
      steps: [{ action: 'read_sensor', target: 'camera_view', speed: 'slow', value: 'trust_me' }]
    }, cameraMeta, BUILTINS);
    assert(!undeclaredValue.ok && undeclaredValue.code === 'invalid_value', 'a primitive without a declared value policy must reject injected values');

    const proposedInterlock = goodManifest();
    (proposedInterlock.safety as { required_sensors: string[] }).required_sensors = ['caller_owned_distance'];
    const sensorResult = validateActionManifest(proposedInterlock, robotArmMeta, BUILTINS);
    assert(!sensorResult.ok && sensorResult.code === 'schema_rejected', 'untrusted manifests cannot introduce unenforced sensor requirements');
  }]
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
console.log(`Action Manifest tests passed (${tests.length} tests).`);
