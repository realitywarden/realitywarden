'use client';

import { useRef, useState } from 'react';
import { ManualProfileExtractor, approveManualImport, type ManualExtractionProposal, type ManualImportRecord } from '@/lib/manual-import/ManualProfileImport';
import type { UiLanguage } from './LabConfigurator';

interface Props {
  language: UiLanguage;
  builtinIntentIds: ReadonlySet<string>;
  existingRecords: readonly ManualImportRecord[];
  onSave: (record: ManualImportRecord) => void;
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

export function ManualImportWizard({ language, builtinIntentIds, existingRecords, onSave, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<{ fileName: string; mediaType: string; text: string; hash: string } | null>(null);
  const [proposal, setProposal] = useState<ManualExtractionProposal | null>(null);
  const [proposalJson, setProposalJson] = useState('');
  const [extraction, setExtraction] = useState<{ model: string; elapsed_ms: number; raw_output: string } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setProposal(null); setConfirmed(false);
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
    setBusy(true); setError(null); setProposal(null); setConfirmed(false);
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
    setProposal(restored); setProposalJson(JSON.stringify(restored, null, 2)); setExtraction(record.extraction); setConfirmed(false); setError(null);
  };

  const zh = language === 'zh';
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={zh ? '导入设备手册' : 'Import device manual'}>
      <section className="flex max-h-[calc(100vh-32px)] w-full max-w-4xl flex-col border border-border bg-surface shadow-xl">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
          <div><h2 className="text-[15px] font-semibold">{zh ? '手册导入' : 'Manual Import'}</h2><p className="text-[11px] text-text-secondary">{zh ? '本地 LLM 提案 · 人工复核 · 仅仿真' : 'Local LLM proposal · human review · simulation only'}</p></div>
          <button type="button" onClick={onClose} className="h-8 border border-border px-3 text-[13px]">{zh ? '关闭' : 'Close'}</button>
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
                  <textarea value={proposalJson} onChange={(event) => { setProposalJson(event.target.value); setConfirmed(false); }} spellCheck={false} className="h-[360px] w-full resize-y border border-border bg-background p-3 font-mono text-[12px] leading-5 text-text-primary" />
                  <details className="mt-3 border border-border bg-surface-raised p-3"><summary className="cursor-pointer text-[12px] font-semibold">{zh ? '原始模型输出（审计）' : 'Raw model output (audit)'}</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-text-secondary">{extraction?.raw_output}</pre></details>
                  <label className="mt-3 flex items-start gap-2 border border-warning bg-warning/10 p-3 text-[12px]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" /><span>{zh ? '我已将能力、目标、工作区、安全包络和动作逐项与原手册核对；保存内容仅用于语义仿真。' : 'I checked capabilities, targets, workspace, envelope, and actions against the source; this record is for semantic simulation only.'}</span></label>
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
