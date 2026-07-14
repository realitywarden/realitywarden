'use client';

/**
 * Action Composer (v0.4 custom actions).
 *
 * Visual editor over the Action Manifest core: the form builds an UNTRUSTED
 * manifest object, `validateActionManifest` decides (schema, primitives,
 * targets, envelope <= profile - rejected, never clamped), and running an
 * action expands it to primitive TaskDSL steps that flow through the SAME
 * runtime safety pipeline as any prompt. This component never executes
 * anything itself.
 */
import { useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  expandManifestToTaskDsl,
  validateActionManifest
} from '@/lib/action-manifest/ActionManifest';
import type { ActionManifest } from '@/lib/action-manifest/ActionManifest';
import { exportActionLibrary, importActionLibrary } from '@/lib/action-manifest/ActionLibrary';
import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskDSL } from '@/types/taskDsl';

/** Built-in intent namespace custom actions must not shadow (decision 3). */
export const BUILTIN_INTENT_IDS: ReadonlySet<string> = new Set([
  'move_object', 'return_home', 'inspect', 'throw_object', 'organize_workspace'
]);

interface StepDraft {
  action: string;
  target: string;
  speed: '' | 'slow' | 'normal' | 'fast';
  force: '' | 'low' | 'medium' | 'high';
}

export interface ActionComposerProps {
  language: 'zh' | 'en';
  deviceMeta: DeviceMeta;
  actions: ActionManifest[];
  onSave: (manifest: ActionManifest) => void;
  onImport: (manifests: ActionManifest[]) => void;
  onDelete: (actionId: string) => void;
  onRun: (manifest: ActionManifest, taskDsl: TaskDSL) => void;
  onClose: () => void;
}

const inputClass = 'h-7 rounded-[3px] border border-border-panel bg-[#0B0C0E] px-2 text-[12px] text-text-primary outline-none focus:border-[#0284C7]';

export function ActionComposer({ language, deviceMeta, actions, onSave, onImport, onDelete, onRun, onClose }: ActionComposerProps) {
  const zh = language === 'zh';
  const [actionId, setActionId] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [maxSpeed, setMaxSpeed] = useState<'slow' | 'normal' | 'fast'>('slow');
  const [maxForce, setMaxForce] = useState<'low' | 'medium' | 'high'>('low');
  const [steps, setSteps] = useState<StepDraft[]>([{ action: 'move_to_pose', target: '', speed: 'slow', force: '' }]);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const capabilities = deviceMeta.capabilities as readonly string[];
  const knownTargets = deviceMeta.constraints.known_targets ?? [];

  const draftManifest = useMemo(() => ({
    manifest_version: 1 as const,
    action_id: actionId.trim(),
    display_name: { zh: nameZh.trim() || actionId.trim(), en: nameEn.trim() || actionId.trim() },
    device_type: deviceMeta.device_type,
    safety: {
      declared_risk: 'low' as const, // discarded by design: risk is recomputed
      required_sensors: [],
      envelope: { max_speed: maxSpeed, max_force: maxForce }
    },
    steps: steps.map((step) => ({
      action: step.action,
      ...(step.target ? { target: step.target } : {}),
      ...(step.speed ? { speed: step.speed } : {}),
      ...(step.force ? { force: step.force } : {})
    }))
  }), [actionId, nameZh, nameEn, deviceMeta.device_type, maxSpeed, maxForce, steps]);

  const validation = useMemo(
    () => validateActionManifest(draftManifest, deviceMeta, BUILTIN_INTENT_IDS),
    [draftManifest, deviceMeta]
  );

  const save = () => {
    if (!validation.ok) {
      setFeedback({ ok: false, text: `${validation.code}: ${validation.detail}` });
      return;
    }
    onSave(validation.manifest);
    setFeedback({ ok: true, text: zh ? `已保存动作 ${validation.manifest.action_id}` : `Saved action ${validation.manifest.action_id}` });
  };

  const run = (manifest: ActionManifest) => {
    const expanded = expandManifestToTaskDsl(manifest, deviceMeta, localName(manifest, language));
    if (!expanded.ok) {
      setFeedback({ ok: false, text: `${expanded.code}: ${expanded.detail}` });
      return;
    }
    onRun(manifest, expanded.taskDsl);
  };

  const importLibrary = async (file: File | null) => {
    if (!file) return;
    try {
      const imported = importActionLibrary(JSON.parse(await file.text()) as unknown, deviceMeta, BUILTIN_INTENT_IDS, new Set(actions.map((action) => action.action_id)));
      if (!imported.ok) {
        setFeedback({ ok: false, text: `${imported.code}: ${imported.detail}` });
        return;
      }
      onImport(imported.actions);
      setFeedback({ ok: true, text: zh ? `已导入 ${imported.actions.length} 个动作` : `Imported ${imported.actions.length} actions` });
    } catch (error) {
      setFeedback({ ok: false, text: `invalid_json: ${error instanceof Error ? error.message : String(error)}` });
    }
  };

  const exportLibrary = () => {
    if (actions.length === 0) return;
    const url = URL.createObjectURL(new Blob([exportActionLibrary(actions)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'realitywarden-action-library.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback({ ok: true, text: zh ? `已导出 ${actions.length} 个动作` : `Exported ${actions.length} actions` });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true">
      <div className="flex max-h-[86vh] w-[720px] max-w-[94vw] flex-col overflow-hidden border border-border-panel bg-bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-panel px-4 py-2.5">
          <div>
            <div className="text-[14px] font-semibold text-text-primary">{zh ? '自定义动作' : 'Custom Actions'}</div>
            <div className="text-[11px] text-text-secondary">
              {zh
                ? '动作由基元步骤组成，运行时经过与任何指令相同的安全管线；越权的包络会被拒绝，不会被收窄放行。'
                : 'Actions are primitive steps; runs go through the same safety pipeline as any prompt. Over-broad envelopes are rejected, never clamped.'}
            </div>
          </div>
          <button type="button" onClick={onClose} className="h-7 rounded-[3px] border border-border-panel px-2 text-[12px] text-text-secondary hover:bg-[#2B2D31]">
            {zh ? '关闭' : 'Close'}
          </button>
        </div>

        <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {/* Saved actions */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? '已保存' : 'Saved'} ({actions.length})</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => importInputRef.current?.click()} className="h-7 border border-border px-2 text-[12px] font-semibold text-text-primary">{zh ? '导入 JSON' : 'Import JSON'}</button>
                <button type="button" onClick={exportLibrary} disabled={actions.length === 0} className="h-7 border border-accent px-2 text-[12px] font-semibold text-accent disabled:opacity-40">{zh ? '导出动作库' : 'Export library'}</button>
                <input ref={importInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importLibrary(event.target.files?.[0] ?? null); event.currentTarget.value = ''; }} />
              </div>
            </div>
            {actions.length === 0 ? (
              <div className="text-[12px] text-text-muted">{zh ? '还没有自定义动作。' : 'No custom actions yet.'}</div>
            ) : (
              <div className="flex flex-col gap-1">
                {actions.map((manifest) => (
                  <div key={manifest.action_id} className="flex items-center gap-2 rounded-[3px] border border-border-panel bg-[#181A1D] px-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-text-primary">{localName(manifest, language)}</div>
                      <div className="truncate text-[11px] text-text-muted">
                        {manifest.action_id} · {manifest.steps.length} {zh ? '步' : 'steps'} · {manifest.safety.envelope.max_speed}/{manifest.safety.envelope.max_force}
                      </div>
                    </div>
                    <button type="button" onClick={() => run(manifest)} className="h-6 rounded-[3px] border border-[#075985] bg-[#0B2233] px-2 text-[11px] font-semibold text-[#38BDF8] hover:bg-[#0F2E45]">
                      {zh ? '运行（仿真）' : 'Run (simulation)'}
                    </button>
                    <button type="button" onClick={() => onDelete(manifest.action_id)} className="h-6 rounded-[3px] border border-[#5A2B2B] px-2 text-[11px] text-[#F87171] hover:bg-[#2A1111]">
                      {zh ? '删除' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Editor */}
          <section className="rounded-[3px] border border-border-panel bg-[#181A1D] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? '新建动作' : 'New action'}</div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
                action_id（snake_case）
                <input value={actionId} onChange={(event) => setActionId(event.target.value)} placeholder="patrol_sweep" className={inputClass} />
              </label>
              <span />
              <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
                {zh ? '名称（中文）' : 'Name (zh)'}
                <input value={nameZh} onChange={(event) => setNameZh(event.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
                {zh ? '名称（英文）' : 'Name (en)'}
                <input value={nameEn} onChange={(event) => setNameEn(event.target.value)} className={inputClass} />
              </label>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[11px] text-text-secondary">
              <span className="font-bold uppercase tracking-wide">{zh ? '安全包络' : 'Safety envelope'}</span>
              <label className="flex items-center gap-1">
                {zh ? '最大速度' : 'max speed'}
                <select value={maxSpeed} onChange={(event) => setMaxSpeed(event.target.value as typeof maxSpeed)} className={inputClass}>
                  {(['slow', 'normal', 'fast'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">
                {zh ? '最大力度' : 'max force'}
                <select value={maxForce} onChange={(event) => setMaxForce(event.target.value as typeof maxForce)} className={inputClass}>
                  {(['low', 'medium', 'high'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <span className="text-text-muted">
                {zh ? `设备档案上限：${deviceMeta.constraints.max_speed}/${deviceMeta.constraints.force_limit}` : `profile limit: ${deviceMeta.constraints.max_speed}/${deviceMeta.constraints.force_limit}`}
              </span>
            </div>

            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? '步骤（基元）' : 'Steps (primitives)'}</span>
                <button
                  type="button"
                  onClick={() => setSteps((current) => current.length >= 16 ? current : [...current, { action: 'move_to_pose', target: '', speed: 'slow', force: '' }])}
                  className="h-6 rounded-[3px] border border-border-panel px-2 text-[11px] text-text-secondary hover:bg-[#2B2D31]"
                >
                  {zh ? '+ 加一步' : '+ Add step'}
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-5 text-right text-[11px] text-text-muted">{index + 1}.</span>
                    <select value={step.action} onChange={(event) => updateStep(setSteps, index, { action: event.target.value })} className={inputClass}>
                      {capabilities.map((capability) => <option key={capability} value={capability}>{capability}</option>)}
                    </select>
                    <select value={step.target} onChange={(event) => updateStep(setSteps, index, { target: event.target.value })} className={inputClass}>
                      <option value="">{zh ? '（无目标）' : '(no target)'}</option>
                      {knownTargets.map((target) => <option key={target} value={target}>{target}</option>)}
                    </select>
                    <select value={step.speed} onChange={(event) => updateStep(setSteps, index, { speed: event.target.value as StepDraft['speed'] })} className={inputClass}>
                      <option value="">speed?</option>
                      {(['slow', 'normal', 'fast'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select value={step.force} onChange={(event) => updateStep(setSteps, index, { force: event.target.value as StepDraft['force'] })} className={inputClass}>
                      <option value="">force?</option>
                      {(['low', 'medium', 'high'] as const).map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setSteps((current) => current.length <= 1 ? current : current.filter((_, i) => i !== index))}
                      className="h-6 rounded-[3px] border border-[#5A2B2B] px-1.5 text-[11px] text-[#F87171] hover:bg-[#2A1111]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={save} className="h-7 rounded-[3px] border border-[#075985] bg-[#0284C7] px-3 text-[12px] font-semibold text-white hover:bg-[#0369A1]">
                {zh ? '校验并保存' : 'Validate & save'}
              </button>
              <span className={`text-[11px] ${validation.ok ? 'text-status-executed-soft' : 'text-status-warning'}`}>
                {validation.ok
                  ? (zh ? '✓ 校验通过（风险等级运行时重算）' : '✓ valid (risk recomputed at run time)')
                  : `${validation.code}`}
              </span>
            </div>
            {!validation.ok && actionId.trim().length > 0 && (
              <div className="mt-1 break-all text-[11px] text-status-warning">{validation.detail}</div>
            )}
          </section>

          {feedback && (
            <div className={`rounded-[3px] border px-2 py-1 text-[11px] ${feedback.ok ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft'}`}>
              {feedback.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function localName(manifest: ActionManifest, language: 'zh' | 'en') {
  return language === 'zh' ? manifest.display_name.zh : manifest.display_name.en;
}

function updateStep(
  setSteps: Dispatch<SetStateAction<StepDraft[]>>,
  index: number,
  patch: Partial<StepDraft>
) {
  setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...patch } : step)));
}
