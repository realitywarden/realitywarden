import { z } from 'zod';
import type { DeviceMeta } from '@/types/deviceMeta';
import { validateActionManifest, type ActionManifest } from './ActionManifest';

const actionLibrarySchema = z.object({
  format: z.literal('realitywarden.action-library'),
  version: z.literal(1),
  exported_at: z.string().datetime(),
  actions: z.array(z.unknown()).min(1).max(100)
}).strict();

export interface ActionLibraryResult {
  ok: true;
  actions: ActionManifest[];
}

export interface ActionLibraryFailure {
  ok: false;
  code: 'invalid_library' | 'invalid_action' | 'duplicate_action' | 'existing_action';
  detail: string;
}

export function importActionLibrary(
  raw: unknown,
  deviceMeta: DeviceMeta,
  builtinIntentIds: ReadonlySet<string>,
  existingActionIds: ReadonlySet<string> = new Set()
): ActionLibraryResult | ActionLibraryFailure {
  const parsed = actionLibrarySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, code: 'invalid_library', detail: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') };
  const actions: ActionManifest[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < parsed.data.actions.length; index += 1) {
    const checked = validateActionManifest(parsed.data.actions[index], deviceMeta, builtinIntentIds);
    if (!checked.ok) return { ok: false, code: 'invalid_action', detail: `actions[${index}]: ${checked.code}: ${checked.detail}` };
    if (seen.has(checked.manifest.action_id)) return { ok: false, code: 'duplicate_action', detail: `duplicate action_id "${checked.manifest.action_id}"` };
    if (existingActionIds.has(checked.manifest.action_id)) return { ok: false, code: 'existing_action', detail: `action_id "${checked.manifest.action_id}" already exists; import is atomic and never overwrites` };
    seen.add(checked.manifest.action_id);
    actions.push(checked.manifest);
  }
  return { ok: true, actions };
}

export function exportActionLibrary(actions: readonly ActionManifest[]): string {
  return JSON.stringify({ format: 'realitywarden.action-library', version: 1, exported_at: new Date().toISOString(), actions }, null, 2);
}
