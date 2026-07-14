'use client';

import { useEffect, useRef, useState } from 'react';
import { ManualProfileExtractor, approveManualImport, manualExtractionProposalSchema, type ManualExtractionProposal, type ManualImportRecord } from '@/lib/manual-import/ManualProfileImport';
import type { UiLanguage } from './LabConfigurator';
import { SemanticDeviceStage } from './SemanticDeviceStage';
import { handleRovingTabKey } from '@/lib/ui/keyboardNavigation';

interface Props {
  language: UiLanguage;
  builtinIntentIds: ReadonlySet<string>;
  existingRecords: readonly ManualImportRecord[];
  onSave: (record: ManualImportRecord) => void;
  onEnable: (record: ManualImportRecord, confirmed: boolean) => { ok: true } | { ok: false; detail: string };
  onReviewActions: (record: ManualImportRecord) => { ok: true } | { ok: false; detail: string };
  onClose: () => void;
}

async function extractFileText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let index = 1; index <= document.numPages; index += 1) {
      const page = await document.getPage(index);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '));
    }
    return pages.join('\n\n');
  }
  return file.text();
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function ManualImportWizard({ language, builtinIntentIds, existingRecords, onSave, onEnable, onReviewActions, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [source, setSource] = useState<{ fileName: string; mediaType: string; text: string; hash: string } | null>(null);
  const [proposal, setProposal] = useState<ManualExtractionProposal | null>(null);
  const [proposalJson, setProposalJson] = useState('');
  const [extraction, setExtraction] = useState<{ model: string; elapsed_ms: number; raw_output: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [enableConfirmed, setEnableConfirmed] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ManualImportRecord | null>(null);
  const [reviewMode, setReviewMode] = useState<'compare' | 'json' | 'raw'>('compare');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const controls = Array.from(modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, select:not([disabled])'))
        .filter((control) => control.getClientRects().length > 0);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [onClose]);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setProposal(null); setConfirmed(false); setSelectedRecord(null); setEnableConfirmed(false);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error(language === 'zh' ? '文件超过 25 MB 上限。' : 'File exceeds the 25 MB limit.');
      const text = (await extractFileText(file)).trim();
      if (!text) throw new Error(language === 'zh' ? '文件没有可提取文本；扫描版 PDF 需要先做 OCR。' : 'No extractable text; scanned PDFs require OCR first.');
      setSource({ fileName: file.name, mediaType: file.type || 'text/plain', text, hash: await sha256(text) });
    } catch (cause) {
      setSource(null);
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setBusy(false); }
  };

  const generate = async () => {
    if (!source) return;
    setBusy(true); setError(null); setProposal(null); setConfirmed(false); setSelectedRecord(null); setEnableConfirmed(false);
    const result = await new ManualProfileExtractor().extract(source.text);
    setBusy(false);
    if (!result.ok) { setError(`${result.failure}: ${result.detail}`); return; }
    setProposal(result.proposal);
    setProposalJson(JSON.stringify(result.proposal, null, 2));
    setExtraction({ model: result.model, elapsed_ms: result.elapsedMs, raw_output: result.raw });
  };

  const save = () => {
    if (!source || !proposal || !extraction) return;
    let edited: unknown;
    try { edited = JSON.parse(proposalJson); } catch { setError(language === 'zh' ? '审阅 JSON 不是有效 JSON。' : 'Reviewed JSON is not valid JSON.'); return; }
    const approved = approveManualImport({
      proposal: edited as ManualExtractionProposal,
      source: { file_name: source.fileName, media_type: source.mediaType, sha256: source.hash, extracted_text: source.text },
      extraction, builtinIntentIds, confirmed
    });
    if (!approved.ok) { setError(approved.detail); return; }
    onSave(approved.record);
    onClose();
  };

  const reviewExisting = (record: ManualImportRecord) => {
    const restored: ManualExtractionProposal = {
      manufacturer: record.device_meta.manufacturer, model: record.device_meta.model, display_name: record.device_meta.display_name,
      device_type: record.device_meta.device_type, capabilities: record.device_meta.capabilities,
      workspace: record.device_meta.constraints.workspace, max_speed: record.device_meta.constraints.max_speed,
      force_limit: record.device_meta.constraints.force_limit, known_targets: record.device_meta.constraints.known_targets ?? [],
      forbidden_zones: record.device_meta.constraints.forbidden_zones, actions: record.action_manifests
    };
    setSource({ fileName: record.source.file_name, mediaType: record.source.media_type, text: record.source.extracted_text, hash: record.source.sha256 });
    setProposal(restored); setProposalJson(JSON.stringify(restored, null, 2)); setExtraction(record.extraction); setConfirmed(false); setEnableConfirmed(false); setSelectedRecord(record); setReviewMode('compare'); setError(null);
  };

  const updateProposalJson = (value: string) => {
    setProposalJson(value); setConfirmed(false); setEnableConfirmed(false); setSelectedRecord(null);
    try {
      const checked = manualExtractionProposalSchema.safeParse(JSON.parse(value));
      if (checked.success) setProposal(checked.data);
    } catch { /* The Save action reports invalid JSON explicitly. */ }
  };

  const enable = () => {
    if (!selectedRecord) return;
    const result = onEnable(selectedRecord, confirmed && enableConfirmed);
    if (!result.ok) { setError(result.detail); return; }
    onClose();
  };

  const reviewActions = () => {
    if (!selectedRecord) return;
    const result = onReviewActions(selectedRecord);
    if (!result.ok) {
      setError(result.detail);
      return;
    }
    // The parent owns the modal-to-modal transition so the newly opened
    // Action Composer keeps focus; the normal close path would focus File.
  };

  const zh = language === 'zh';
  return (
    <div ref={modalRef} data-manual-import-modal className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={zh ? '导入设备手册' : 'Import device manual'}>
      <section className="flex max-h-[calc(100vh-32px)] w-full max-w-4xl flex-col border border-border bg-surface shadow-xl">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div><h2 className="text-[15px] font-semibold">{zh ? '手册导入' : 'Manual Import'}</h2><p className="text-[11px] text-text-secondary">{zh ? '本地 LLM 提案 · 人工复核 · 仅仿真' : 'Local LLM proposal · human review · simulation only'}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="h-8 border border-border px-3 text-[13px]">{zh ? '关闭' : 'Close'}</button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="border-2 border-simulation bg-simulation/10 p-3 text-[13px] text-text-primary">
            <strong className="text-simulation">SIMULATION ONLY</strong> — {zh ? '导入不会启用真实硬件、安装适配器或绕过安全治理。模型输出是不可信提案。' : 'Import never enables real hardware, installs an adapter, or bypasses safety governance. Model output is untrusted.'}
          </div>
          <div className="mt-4 grid grid-cols-[220px_minmax(0,1fr)] gap-4">
            <div className="space-y-3">
              <input ref={fileRef} type="file" accept=".pdf,.txt,.md,text/plain,application/pdf" className="hidden" onChange={(event) => void chooseFile(event.target.files?.[0])} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="h-9 w-full border border-accent px-3 text-[13px] font-semibold text-accent disabled:opacity-40">{zh ? '选择 PDF / 文本' : 'Choose PDF / text'}</button>
              {source && <div className="border border-border bg-surface-raised p-3 text-[12px]"><div className="break-all font-semibold">{source.fileName}</div><div className="mt-1 text-text-secondary">{source.text.length.toLocaleString()} {zh ? '字符' : 'characters'}</div><div className="mt-1 break-all font-mono text-[11px] text-text-secondary">SHA256 {source.hash}</div></div>}
              <button type="button" onClick={() => void generate()} disabled={!source || busy} className="h-9 w-full bg-accent px-3 text-[13px] font-semibold text-white disabled:opacity-40">{busy ? (zh ? '处理中…' : 'Working…') : (zh ? '生成本地草案' : 'Generate local draft')}</button>
              <p className="text-[11px] leading-5 text-text-secondary">{zh ? '扫描版 PDF 不含文本层时会明确失败，不会静默猜测。' : 'Scanned PDFs without a text layer fail explicitly; no guessing fallback.'}</p>
              {existingRecords.length > 0 && <div className="border-t border-border pt-3"><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? `已保存提案 (${existingRecords.length})` : `Saved proposals (${existingRecords.length})`}</div><div className="max-h-40 space-y-1 overflow-auto">{existingRecords.map((record) => <button key={record.device_meta.profile_id} type="button" onClick={() => reviewExisting(record)} className="w-full border border-border bg-surface-raised p-2 text-left text-[12px] hover:border-simulation"><span className="block truncate font-semibold">{record.device_meta.display_name}</span><span className="block truncate text-[11px] text-text-secondary">{record.source.file_name} · simulation-only</span></button>)}</div></div>}
            </div>
            <div className="min-w-0">
              {!proposal ? <div className="flex min-h-[360px] items-center justify-center border border-dashed border-border text-[13px] text-text-secondary">{zh ? '选择手册并生成草案后，在此复核完整 JSON。' : 'Choose a manual and generate a draft to review its complete JSON here.'}</div> : (
                <>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-semibold">{zh ? '人工复核草案' : 'Human review draft'}</h3><span className="text-[11px] text-text-secondary">{extraction?.model} · {extraction?.elapsed_ms}ms</span></div>
                  <div className="h-44 overflow-hidden border border-simulation bg-[#232529]" aria-label={zh ? '语义几何预览' : 'Semantic geometry preview'}>
                    <SemanticDeviceStage language={language} deviceType={proposal.device_type} state={{ status: 'idle', current_position: 'simulation_origin' }} blocked={false} workspaceDevices={[{ id: 'manual-preview', label: proposal.display_name, deviceType: proposal.device_type, state: { status: 'idle' }, position: [0, 0.02, 0] }]} selectedWorkspaceDeviceId="manual-preview" />
                  </div>
                  <div className="border-x border-b border-simulation bg-simulation/10 px-2 py-1 text-[11px] text-text-secondary"><strong className="text-simulation">{zh ? '语义模板' : 'SEMANTIC TEMPLATE'}</strong> — {zh ? '非厂商 CAD，不证明尺寸、运动学或物理结果。' : 'Not vendor CAD; does not prove dimensions, kinematics, or physical outcomes.'}</div>
                  <div className="mt-3 grid grid-cols-3 border border-border" role="tablist" aria-label={zh ? '手册审阅视图' : 'Manual review views'}>{(['compare', 'json', 'raw'] as const).map((mode, index, modes) => <button key={mode} id={`manual-review-tab-${mode}`} type="button" role="tab" aria-selected={reviewMode === mode} aria-controls={`manual-review-panel-${mode}`} tabIndex={reviewMode === mode ? 0 : -1} onClick={() => setReviewMode(mode)} onKeyDown={(event) => handleRovingTabKey(event, index, modes.length, (nextIndex) => setReviewMode(modes[nextIndex]))} className={`h-8 text-[12px] font-semibold ${reviewMode === mode ? 'bg-surface-raised text-text-primary' : 'text-text-secondary'}`}>{mode === 'compare' ? (zh ? '来源对照' : 'Source compare') : mode === 'json' ? 'JSON' : (zh ? '原始输出' : 'Raw output')}</button>)}</div>
                  <div id="manual-review-panel-compare" role="tabpanel" aria-labelledby="manual-review-tab-compare" hidden={reviewMode !== 'compare'} className="grid h-[230px] grid-cols-2 border-x border-b border-border"><div className="overflow-auto border-r border-border p-3"><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? '提取原文' : 'Extracted source'}</div><pre className="whitespace-pre-wrap break-words text-[11px] leading-5 text-text-primary">{source?.text}</pre></div><div className="overflow-auto p-3"><div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-secondary">{zh ? '结构化提案（需逐项核对）' : 'Structured proposal (verify each field)'}</div><dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-2 text-[12px]"><dt className="text-text-secondary">Manufacturer</dt><dd>{proposal.manufacturer}</dd><dt className="text-text-secondary">Model</dt><dd>{proposal.model}</dd><dt className="text-text-secondary">Type</dt><dd>{proposal.device_type}</dd><dt className="text-text-secondary">Capabilities</dt><dd className="break-words">{proposal.capabilities.join(', ')}</dd><dt className="text-text-secondary">Targets</dt><dd className="break-words">{proposal.known_targets.join(', ') || '-'}</dd><dt className="text-text-secondary">Envelope</dt><dd>{proposal.max_speed} / {proposal.force_limit}</dd><dt className="text-text-secondary">Actions</dt><dd>{proposal.actions.length}</dd></dl></div></div>
                  <textarea id="manual-review-panel-json" role="tabpanel" aria-labelledby="manual-review-tab-json" hidden={reviewMode !== 'json'} value={proposalJson} onChange={(event) => updateProposalJson(event.target.value)} spellCheck={false} className="h-[230px] w-full resize-none border-x border-b border-border bg-background p-3 font-mono text-[12px] leading-5 text-text-primary" />
                  <pre id="manual-review-panel-raw" role="tabpanel" aria-labelledby="manual-review-tab-raw" hidden={reviewMode !== 'raw'} className="h-[230px] overflow-auto whitespace-pre-wrap break-words border-x border-b border-border p-3 text-[11px] leading-5 text-text-secondary">{extraction?.raw_output}</pre>
                  <label className="mt-3 flex items-start gap-2 border border-warning bg-warning/10 p-3 text-[12px]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" /><span>{zh ? '我已将能力、目标、工作区、安全包络和动作逐项与原手册核对；保存内容仅用于语义仿真。' : 'I checked capabilities, targets, workspace, envelope, and actions against the source; this record is for semantic simulation only.'}</span></label>
                  {selectedRecord && !selectedRecord.virtual_lab?.enabled && <div className="mt-3 border-2 border-simulation p-3"><div className="text-[13px] font-semibold text-simulation">{zh ? '第二道门：启用到 Virtual Lab' : 'Second gate: enable in Virtual Lab'}</div><label className="mt-2 flex items-start gap-2 text-[12px]"><input type="checkbox" checked={enableConfirmed} onChange={(event) => setEnableConfirmed(event.target.checked)} className="mt-0.5" /><span>{zh ? '我确认拥有该手册的使用权，并理解几何是通用语义模板；启用仅创建仿真资产，不安装或连接真实设备 Adapter。' : 'I confirm source usage rights and understand geometry is generic; enablement creates only a simulation asset and never installs or connects a real-device adapter.'}</span></label><button type="button" onClick={enable} disabled={!confirmed || !enableConfirmed} className="mt-3 h-9 w-full bg-simulation px-3 text-[13px] font-semibold text-black disabled:opacity-40">{zh ? '启用并添加到 Virtual Lab' : 'Enable and add to Virtual Lab'}</button></div>}
                  {selectedRecord?.virtual_lab?.enabled && (
                    <div className="mt-3 border border-simulation bg-simulation/10 p-3 text-[12px] text-text-primary">
                      <div className="font-semibold text-simulation">{zh ? '已启用到 Virtual Lab（仅仿真）。' : 'Enabled in Virtual Lab (simulation only).'}</div>
                      <p className="mt-1 leading-5 text-text-secondary">
                        {zh
                          ? `手册包含 ${selectedRecord.action_manifests.length} 个未自动安装的动作提案。进入 Action Composer 后仍需逐项审阅冲突并显式确认。`
                          : `The manual contains ${selectedRecord.action_manifests.length} action proposals that were not auto-installed. Action Composer still requires conflict review and explicit confirmation.`}
                      </p>
                      <button type="button" onClick={reviewActions} disabled={selectedRecord.action_manifests.length === 0} className="mt-2 h-8 border border-simulation px-3 text-[12px] font-semibold text-simulation disabled:opacity-40">
                        {zh ? '在 Action Composer 中审阅动作' : 'Review actions in Action Composer'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {error && <div className="mt-4 border border-danger bg-danger/10 p-3 text-[12px] text-danger" role="alert">{error}</div>}
        </div>
        <footer className="flex h-14 shrink-0 items-center justify-between border-t border-border px-4"><span className="text-[11px] text-text-secondary">{zh ? '无静默回退 · 保存时重新严格验证' : 'No silent fallback · strict revalidation on save'}</span><button type="button" onClick={save} disabled={!proposal || !confirmed || busy} className="h-9 bg-simulation px-4 text-[13px] font-semibold text-black disabled:opacity-40">{zh ? '保存 simulation-only 提案' : 'Save simulation-only proposal'}</button></footer>
      </section>
    </div>
  );
}
