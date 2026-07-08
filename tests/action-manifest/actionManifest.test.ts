/**
 * Action Manifest behavioral tests (no hardware, no Ollama).
 * Release gate: the cooperating-malicious manifest suite — every manifest
 * that tries to loosen an envelope, use undeclared primitives/targets, or
 * shadow a built-in must be rejected with an explicit code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateActionManifest, expandManifestToTaskDsl } from '../../lib/action-manifest/ActionManifest';
import type { DeviceMeta } from '../../types/deviceMeta';

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

const BUILTINS = new Set(['move_object', 'return_home', 'inspect', 'throw_object', 'organize_workspace']);

function goodManifest() {
  return {
    manifest_version: 1,
    action_id: 'scan_left_to_right',
    display_name: { zh: '从左到右扫描', en: 'Scan left to right' },
    device_type: 'robot_arm',
    safety: {
      declared_risk: 'low',
      required_sensors: ['distance'],
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
  }]
];

for (const [name, test] of tests) {
  test();
  console.log(`ok - ${name}`);
}
console.log(`Action Manifest tests passed (${tests.length} tests).`);
