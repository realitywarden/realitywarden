/**
 * Explicit installation boundary for action proposals extracted from manuals.
 *
 * A reviewed manual record and its Virtual Lab asset remain untrusted,
 * simulation-only data. This module never mutates an action library and never
 * creates, selects, or enables an adapter. It only returns a revalidated batch
 * after a separate operator confirmation; the caller may then copy that batch
 * into the ordinary custom-action library.
 */
import { validateActionManifest, type ActionManifest } from '../action-manifest/ActionManifest';
import type { DeviceMeta } from '../../types/deviceMeta';
import { validateStoredManualImport, type ManualImportRecord } from './ManualProfileImport';

export type ManualActionCandidateStatus = 'ready' | 'conflict';

export interface ManualActionInstallCandidate {
  actionId: string;
  manifest: ActionManifest;
  status: ManualActionCandidateStatus;
  detail: string;
}

export type ManualActionInstallReview =
  | { ok: true; candidates: ManualActionInstallCandidate[] }
  | { ok: false; detail: string; candidates: [] };

interface ReviewInput {
  record: ManualImportRecord;
  currentDeviceMeta: DeviceMeta;
  existingActions: readonly ActionManifest[];
  builtinIntentIds: ReadonlySet<string>;
}

export function reviewManualActionInstall(input: ReviewInput): ManualActionInstallReview {
  const checked = validateStoredManualImport(input.record, input.builtinIntentIds);
  if (!checked.ok) return { ok: false, detail: `manual record rejected: ${checked.detail}`, candidates: [] };
  if (!checked.record.virtual_lab?.enabled || checked.record.virtual_lab.execution_mode !== 'simulation') {
    return { ok: false, detail: 'manual actions require a separately enabled simulation-only Virtual Lab asset', candidates: [] };
  }
  if (checked.record.device_meta.profile_id !== input.currentDeviceMeta.profile_id) {
    return { ok: false, detail: 'the enabled manual asset must be the current Action Composer device', candidates: [] };
  }
  if (
    input.currentDeviceMeta.supported_adapters.length !== 1
    || input.currentDeviceMeta.supported_adapters[0] !== 'simulator'
  ) {
    return { ok: false, detail: 'manual actions can only be reviewed for a structurally simulation-only device', candidates: [] };
  }

  const existingIds = new Set(input.existingActions.map((action) => action.action_id));
  const candidates = checked.record.action_manifests.map((manifest): ManualActionInstallCandidate => {
    const validation = validateActionManifest(manifest, input.currentDeviceMeta, input.builtinIntentIds);
    if (!validation.ok) {
      return {
        actionId: manifest.action_id,
        manifest,
        status: 'conflict',
        detail: `revalidation failed (${validation.code}): ${validation.detail}`
      };
    }
    if (existingIds.has(validation.manifest.action_id)) {
      return {
        actionId: validation.manifest.action_id,
        manifest: validation.manifest,
        status: 'conflict',
        detail: 'an action with this ID already exists; existing actions are never overwritten'
      };
    }
    return {
      actionId: validation.manifest.action_id,
      manifest: validation.manifest,
      status: 'ready',
      detail: 'ready for explicit copy into the local custom-action library'
    };
  });
  return { ok: true, candidates };
}

export function installReviewedManualActions(input: ReviewInput & {
  selectedActionIds: readonly string[];
  confirmed: boolean;
}): { ok: true; actions: ActionManifest[] } | { ok: false; detail: string } {
  if (input.confirmed !== true) return { ok: false, detail: 'explicit manual-action installation confirmation is required' };
  if (input.selectedActionIds.length === 0) return { ok: false, detail: 'select at least one reviewed action' };
  if (new Set(input.selectedActionIds).size !== input.selectedActionIds.length) return { ok: false, detail: 'duplicate selected action ids are rejected' };

  // Re-run the complete review at the commit point. The visible review is not
  // authority and may be stale if the device or action library changed.
  const review = reviewManualActionInstall(input);
  if (!review.ok) return review;
  const selectedIds = new Set(input.selectedActionIds);
  const unknownId = input.selectedActionIds.find((actionId) => !review.candidates.some((candidate) => candidate.actionId === actionId));
  if (unknownId) return { ok: false, detail: `selected action is not part of the reviewed manual: ${unknownId}` };
  const selected = review.candidates.filter((candidate) => selectedIds.has(candidate.actionId));
  const conflict = selected.find((candidate) => candidate.status !== 'ready');
  if (conflict) return { ok: false, detail: `action ${conflict.actionId} cannot be installed: ${conflict.detail}` };
  return { ok: true, actions: selected.map((candidate) => candidate.manifest) };
}
