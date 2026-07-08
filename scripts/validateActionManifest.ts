/**
 * CLI: validate an Action Manifest JSON file against a device profile.
 * Usage: npm run manifest:validate -- path/to/manifest.json [profileId]
 * Default profile: virtual-robot-arm. Exit 0 = valid, 1 = rejected.
 */
import fs from 'node:fs';
import path from 'node:path';
import { validateActionManifest, expandManifestToTaskDsl } from '../lib/action-manifest/ActionManifest';
import type { DeviceMeta } from '../types/deviceMeta';

const BUILTINS = new Set(['move_object', 'return_home', 'inspect', 'throw_object', 'organize_workspace']);

const [, , manifestPath, profileId = 'virtual-robot-arm'] = process.argv;
if (!manifestPath) {
  console.error('usage: npm run manifest:validate -- <manifest.json> [profileId]');
  process.exit(1);
}
const metaPath = path.resolve(process.cwd(), 'profiles', profileId, 'device.meta.json');
if (!fs.existsSync(metaPath)) {
  console.error(`unknown profile "${profileId}" (no ${metaPath})`);
  process.exit(1);
}
const deviceMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as DeviceMeta;

let raw: unknown;
try {
  raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), manifestPath), 'utf8'));
} catch (error) {
  console.error(`REJECTED (unreadable): ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const result = validateActionManifest(raw, deviceMeta, BUILTINS);
if (!result.ok) {
  console.error(`REJECTED (${result.code}): ${result.detail}`);
  process.exit(1);
}
const expanded = expandManifestToTaskDsl(result.manifest, deviceMeta, `[validate] ${result.manifest.action_id}`);
if (!expanded.ok) {
  console.error(`REJECTED (${expanded.code}): ${expanded.detail}`);
  process.exit(1);
}
console.log(`VALID: ${result.manifest.action_id} -> ${expanded.taskDsl.steps.length} primitive steps, recomputed risk=${expanded.taskDsl.risk_level}`);
console.log('NOTE: validity is not permission - every primitive still passes the full safety pipeline at run time.');
