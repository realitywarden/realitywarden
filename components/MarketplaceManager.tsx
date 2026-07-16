'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UiLanguage } from './LabConfigurator';

interface RecordView { packageId: string; packageVersion: string; assetId: string; trustTier: string; publisherName: string; state: 'installed_disabled' | 'simulation_enabled'; digestSha256: string }
interface TrustView { keyId: string; displayName: string; revoked: boolean }
interface DistributionView { configured: boolean; catalogUrl: string | null; catalogKeyId: string | null; error: string | null }
interface StateView { ok: boolean; error?: string; quarantinedPath?: string | null; records?: RecordView[]; communityTrustEntries?: TrustView[]; distribution?: DistributionView }
interface Review { canceled?: boolean; ok?: boolean; error?: string; rawPackage?: unknown; rawPublisher?: unknown; summary?: { packageId: string; packageVersion: string; assetId: string; assetName: string; digestSha256: string; trustTier: string; publisherName: string }; entry?: TrustView; fingerprintSha256?: string }
interface CatalogEntry { package_id: string; package_version: string; asset_id: string; asset_name: string; device_type: string; support_level: 'simulation_only' | 'read_only'; package_url: string; package_file_sha256: string; package_digest_sha256: string }
interface CatalogView { catalogId: string; generatedAt: string; expiresAt: string; digestSha256: string; trustTier: string; publisherName: string; entries: CatalogEntry[] }
interface CatalogResponse { ok: boolean; error?: string; code?: string; source?: 'network' | 'verified_cache'; catalog?: CatalogView }
interface SubmissionReview { canceled?: boolean; ok?: boolean; error?: string; rawAsset?: unknown; summary?: { assetId: string; assetName: string; assetVersion: string; assetDigestSha256: string; executionAuthorityGranted: false; realAdapterEnabled: false; hardwareSignalSent: false } }
interface Bridge {
  state(): Promise<StateView>; browsePackage(): Promise<Review>; install(raw: unknown, confirmed: boolean): Promise<StateView>;
  catalog(useCache: boolean): Promise<CatalogResponse>; reviewCatalogPackage(id: string, version: string, digest: string): Promise<Review>;
  browseSubmissionAsset(): Promise<SubmissionReview>; exportSubmissionDraft(rawAsset: unknown, sourcePackageId: string | null, changeSummary: string, confirmed: boolean): Promise<{ ok?: boolean; canceled?: boolean; error?: string; filePath?: string; digestSha256?: string }>;
  enableSimulation(id: string, confirmed: boolean): Promise<StateView>; uninstall(id: string, confirmed: boolean): Promise<StateView>;
  browsePublisher(): Promise<Review>; trustPublisher(raw: unknown, confirmed: boolean): Promise<StateView>;
  revokePublisher(id: string, confirmed: boolean): Promise<StateView>; resetState(confirmed: boolean): Promise<StateView>;
}

const api = () => (window as unknown as { openReality?: { marketplace?: Bridge } }).openReality?.marketplace ?? null;

export function MarketplaceManager({
  language,
  onClose,
  onLifecycleChange,
  workspaceBindings = {}
}: {
  language: UiLanguage;
  onClose: () => void;
  onLifecycleChange?: () => Promise<unknown>;
  workspaceBindings?: Record<string, { ok: boolean; detail: string }>;
}) {
  const zh = language === 'zh';
  const desktopAvailable = api() !== null;
  const [state, setState] = useState<StateView>({ ok: true, records: [], communityTrustEntries: [] });
  const [packageReview, setPackageReview] = useState<Review | null>(null);
  const [publisherReview, setPublisherReview] = useState<Review | null>(null);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [submissionReview, setSubmissionReview] = useState<SubmissionReview | null>(null);
  const [submissionSource, setSubmissionSource] = useState<string>('new_asset');
  const [changeSummary, setChangeSummary] = useState('');
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const desktop = api();
    setState(desktop ? await desktop.state() : { ok: false, error: zh ? 'Marketplace 仅在桌面应用中可用。' : 'Marketplace is available in the desktop app only.' });
  }, [zh]);
  useEffect(() => { void refresh(); }, [refresh]);

  const run = async (operation: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(true); setMessage(null);
    try {
      const result = await operation();
      if (!result.ok) setMessage(result.error ?? (zh ? '操作被拒绝。' : 'Operation rejected.'));
      else { setMessage(success); setConfirmed({}); setPackageReview(null); setPublisherReview(null); await refresh(); await onLifecycleChange?.(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const toggle = (id: string) => setConfirmed((current) => ({ ...current, [id]: !current[id] }));
  const loadCatalog = async (useCache: boolean) => {
    setBusy(true); setMessage(null); setPackageReview(null);
    try {
      const result = await api()!.catalog(useCache);
      setCatalog(result);
      if (!result.ok) setMessage(result.error ?? (zh ? '签名目录被拒绝。' : 'Signed catalog rejected.'));
    } catch (error) { setCatalog(null); setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const reviewCatalogEntry = async (entry: CatalogEntry) => {
    if (!catalog?.ok || !catalog.catalog) return;
    setBusy(true); setMessage(null); setPackageReview(null); setConfirmed((current) => ({ ...current, install: false }));
    try {
      const result = await api()!.reviewCatalogPackage(entry.package_id, entry.package_version, catalog.catalog.digestSha256);
      setPackageReview(result);
      if (!result.ok) setMessage(result.error ?? (zh ? '目录包被拒绝。' : 'Catalog package rejected.'));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const browseSubmissionAsset = async () => {
    setBusy(true); setMessage(null); setSubmissionReview(null); setConfirmed((current) => ({ ...current, submission: false }));
    try {
      const result = await api()!.browseSubmissionAsset();
      if (!result.canceled) {
        setSubmissionReview(result);
        const matching = result.summary ? (state.records ?? []).find((record) => record.assetId === result.summary!.assetId) : undefined;
        setSubmissionSource(matching?.packageId ?? 'new_asset');
        if (!result.ok) setMessage(result.error ?? (zh ? '提交资产被拒绝。' : 'Submission asset rejected.'));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  const exportSubmissionDraft = async () => {
    if (!submissionReview?.ok || !submissionReview.rawAsset) return;
    setBusy(true); setMessage(null);
    try {
      const result = await api()!.exportSubmissionDraft(submissionReview.rawAsset, submissionSource === 'new_asset' ? null : submissionSource, changeSummary, confirmed.submission === true);
      if (result.canceled) setMessage(zh ? '已取消导出；没有上传任何内容。' : 'Export canceled; nothing was uploaded.');
      else if (!result.ok) setMessage(result.error ?? (zh ? '提交草稿导出被拒绝。' : 'Submission draft export rejected.'));
      else {
        setMessage(zh ? `未签名提交草稿已导出：${result.filePath}；没有自动上传。` : `Unsigned submission draft exported: ${result.filePath}. Nothing was uploaded automatically.`);
        setSubmissionReview(null); setSubmissionSource('new_asset'); setChangeSummary(''); setConfirmed((current) => ({ ...current, submission: false }));
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return <div data-marketplace-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
    <section className="flex max-h-[90vh] w-full max-w-5xl flex-col border border-border bg-surface shadow-2xl" aria-labelledby="marketplace-title">
      <header className="flex items-start justify-between border-b border-border bg-surface-raised px-5 py-4">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">SIMULATION-ONLY ASSET TRUST</div><h2 id="marketplace-title" className="mt-1 text-xl font-semibold">RealityWarden Marketplace</h2><p className="mt-1 text-sm text-text-secondary">{zh ? '签名声明式资产；安装后默认禁用，二次确认才可进入仿真。永不授予真机执行权限。' : 'Signed declarative assets. Installs default disabled; simulation needs a second confirmation. Never grants real-hardware authority.'}</p></div>
        <button type="button" onClick={onClose} className="border border-border px-3 py-1.5 text-sm">{zh ? '关闭' : 'Close'}</button>
      </header>
      <div className="min-h-0 overflow-y-auto p-5">
        {message && <div role="alert" className="mb-4 border border-status-warning-edge bg-status-warning-surface p-3 text-sm text-status-warning">{message}</div>}
        {!state.ok && <section className="mb-5 border-2 border-status-blocked-edge bg-status-blocked-surface p-4"><h3 className="font-bold text-status-blocked-soft">{desktopAvailable ? (zh ? 'Marketplace 状态已阻断' : 'Marketplace state blocked') : (zh ? '需要桌面应用' : 'Desktop app required')}</h3><p className="mt-2 break-words text-sm">{state.error}</p>{state.quarantinedPath && <p className="mt-1 break-all text-xs text-text-secondary">{state.quarantinedPath}</p>}{desktopAvailable && <><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={!!confirmed.reset} onChange={() => toggle('reset')} />{zh ? '我确认丢弃损坏状态并创建空白状态；不会静默修复或降级。' : 'I confirm discarding corrupt state and creating an empty state; nothing is silently repaired or downgraded.'}</label><button disabled={!confirmed.reset || busy} type="button" onClick={() => void run(() => api()!.resetState(true), zh ? '已显式重置。' : 'Explicitly reset.')} className="mt-3 border border-status-blocked-edge px-3 py-2 text-sm font-semibold text-status-blocked-soft disabled:opacity-40">{zh ? '重置空白状态' : 'Reset to empty state'}</button></>}</section>}

        <section className="mb-5 border-2 border-status-warning-edge bg-status-warning-surface p-4" aria-labelledby="marketplace-catalog-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 id="marketplace-catalog-title" className="font-semibold text-status-warning">{zh ? '签名分发目录' : 'Signed distribution catalog'}</h3><p className="mt-1 max-w-3xl text-xs text-text-secondary">{zh ? '只使用此签名应用内置的 Official 目录密钥和固定 HTTPS 地址。网络刷新与已验证缓存均需显式选择；失败时不自动回退、不重试。' : 'Uses only the Official catalog key and fixed HTTPS address bundled with this signed app. Network refresh and verified cache are explicit choices; failures never auto-fallback or retry.'}</p></div>
            <span className={`border px-2 py-1 text-[10px] font-bold ${state.distribution?.configured ? 'border-status-executed-edge text-status-executed-soft' : 'border-status-blocked-edge text-status-blocked-soft'}`}>{state.distribution?.configured ? 'OFFICIAL KEY BOUND' : 'NOT PROVISIONED'}</span>
          </div>
          {!state.distribution?.configured && <div role="status" className="mt-3 border border-status-blocked-edge bg-status-blocked-surface p-3 text-xs text-status-blocked-soft">{state.distribution?.error ?? (zh ? '此构建未配置 Marketplace 目录；仍可本地审阅签名包。' : 'This build has no Marketplace catalog configuration; local signed-package review remains available.')}</div>}
          {state.distribution?.configured && <div className="mt-3 grid gap-1 text-[11px] text-text-secondary"><div className="break-all"><span className="font-semibold">URL</span> {state.distribution.catalogUrl}</div><div className="break-all"><span className="font-semibold">KEY</span> {state.distribution.catalogKeyId}</div></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={!state.ok || !state.distribution?.configured || busy} type="button" onClick={() => void loadCatalog(false)} className="border border-status-warning-edge bg-surface px-3 py-2 text-sm font-semibold text-status-warning disabled:opacity-40">{zh ? '从网络刷新签名目录' : 'Refresh signed catalog from network'}</button>
            <button disabled={!state.ok || !state.distribution?.configured || busy} type="button" onClick={() => void loadCatalog(true)} className="border border-border bg-surface px-3 py-2 text-sm font-semibold disabled:opacity-40">{zh ? '显式使用已验证缓存' : 'Explicitly use verified cache'}</button>
          </div>
          {catalog?.ok && catalog.catalog && <div className="mt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-secondary"><span className="font-bold text-status-executed-soft">{catalog.source === 'network' ? 'VERIFIED NETWORK' : 'VERIFIED CACHE'}</span><span>{catalog.catalog.publisherName} · {catalog.catalog.trustTier.toUpperCase()}</span><span>{zh ? '到期' : 'Expires'} {catalog.catalog.expiresAt}</span></div>
            <div className="mt-1 break-all font-mono text-[10px] text-text-muted">CATALOG SHA-256 {catalog.catalog.digestSha256}</div>
            {catalog.catalog.entries.length === 0 ? <p className="mt-3 text-sm text-text-secondary">{zh ? '已验证目录当前为空。' : 'The verified catalog is empty.'}</p> : <div className="mt-3 grid gap-3 lg:grid-cols-2">{catalog.catalog.entries.map((entry) => <article key={`${entry.package_id}@${entry.package_version}`} className="border border-status-warning-edge bg-surface p-3 text-sm">
              <div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{entry.asset_name}</div><div className="mt-1 text-xs text-text-secondary">{entry.device_type} · {entry.package_id} · v{entry.package_version}</div></div><span className="border border-status-warning-edge px-2 py-1 text-[10px] font-bold text-status-warning">{entry.support_level === 'read_only' ? 'READ ONLY' : 'SIMULATION ONLY'}</span></div>
              <div className="mt-2 break-all font-mono text-[10px] text-text-muted">PACKAGE SHA-256 {entry.package_digest_sha256}</div>
              <button disabled={busy} type="button" onClick={() => void reviewCatalogEntry(entry)} className="mt-3 border border-accent px-3 py-2 text-xs font-semibold text-accent disabled:opacity-40">{zh ? '下载并权威审阅' : 'Download and authoritative review'}</button>
            </article>)}</div>}
          </div>}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="border border-border p-4"><h3 className="font-semibold">{zh ? '1. 发布者信任' : '1. Publisher trust'}</h3><p className="mt-1 text-xs text-text-secondary">{zh ? '本地密钥永远只能是 Community；Official / Verified 只能随签名应用更新提供。' : 'Local keys are always Community. Official / Verified keys only arrive in a signed app update.'}</p><button disabled={!state.ok || busy} type="button" onClick={async () => { const result = await api()!.browsePublisher(); if (!result.canceled) { setPublisherReview(result); setMessage(result.ok ? null : result.error ?? null); } }} className="mt-3 border border-border bg-surface-raised px-3 py-2 text-sm font-semibold disabled:opacity-40">{zh ? '浏览发布者密钥…' : 'Browse publisher key…'}</button>
            {publisherReview?.ok && publisherReview.entry && <div className="mt-3 border border-status-warning-edge bg-status-warning-surface p-3 text-sm"><div className="font-semibold text-status-warning">COMMUNITY · {publisherReview.entry.displayName}</div><div className="mt-1 break-all font-mono text-[11px] text-text-secondary">SHA-256 {publisherReview.fingerprintSha256}</div><label className="mt-3 flex gap-2"><input type="checkbox" checked={!!confirmed.publisherImport} onChange={() => toggle('publisherImport')} />{zh ? '我已核对身份和指纹，并明确仅授予 Community 信任。' : 'I verified identity and fingerprint and grant Community trust only.'}</label><button disabled={!confirmed.publisherImport || busy} type="button" onClick={() => void run(() => api()!.trustPublisher(publisherReview.rawPublisher, true), zh ? 'Community 发布者已加入信任库。' : 'Community publisher trusted.')} className="mt-3 border border-status-warning-edge px-3 py-2 font-semibold text-status-warning disabled:opacity-40">{zh ? '信任此发布者' : 'Trust publisher'}</button></div>}
            <div className="mt-4 space-y-2">{(state.communityTrustEntries ?? []).map((entry) => <div key={entry.keyId} className="border border-border bg-surface-raised p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-semibold">{entry.displayName}</span><span className="text-xs font-bold text-status-warning">{entry.revoked ? 'REVOKED' : 'COMMUNITY'}</span></div><div className="mt-1 font-mono text-[11px] text-text-muted">{entry.keyId}</div>{!entry.revoked && <><label className="mt-2 flex gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!!confirmed[`revoke:${entry.keyId}`]} onChange={() => toggle(`revoke:${entry.keyId}`)} />{zh ? '我确认撤销会立即使其已启用资产失效。' : 'I confirm revocation immediately disables its enabled assets.'}</label><button disabled={!confirmed[`revoke:${entry.keyId}`] || busy} type="button" onClick={() => void run(() => api()!.revokePublisher(entry.keyId, true), zh ? '已撤销；相关资产不再进入运行时。' : 'Revoked; related assets no longer enter runtime.')} className="mt-2 text-xs font-semibold text-status-blocked-soft disabled:opacity-40">{zh ? '撤销发布者' : 'Revoke publisher'}</button></>}</div>)}</div>
          </section>

          <section className="border border-border p-4"><h3 className="font-semibold">{zh ? '2. 审阅并安装签名包' : '2. Review and install signed package'}</h3><p className="mt-1 text-xs text-text-secondary">{zh ? '主进程执行权威签名、声明式内容与 Reality Asset 验证。' : 'The main process applies authoritative signature, declarative-content, and Reality Asset validation.'}</p><button disabled={!state.ok || busy} type="button" onClick={async () => { const result = await api()!.browsePackage(); if (!result.canceled) { setPackageReview(result); setMessage(result.ok ? null : result.error ?? null); } }} className="mt-3 border border-accent px-3 py-2 text-sm font-semibold text-accent disabled:opacity-40">{zh ? '浏览签名包…' : 'Browse signed package…'}</button>
            {packageReview?.ok && packageReview.summary && <div className="mt-3 border border-accent bg-surface-raised p-3 text-sm"><div className="font-semibold">{packageReview.summary.assetName}</div><div className="mt-1 text-xs text-text-secondary">{packageReview.summary.packageId} · v{packageReview.summary.packageVersion} · {packageReview.summary.trustTier.toUpperCase()}</div><div className="mt-2 break-all font-mono text-[11px] text-text-muted">SHA-256 {packageReview.summary.digestSha256}</div><div className="mt-2 text-xs font-bold text-status-warning">INSTALLS DISABLED · SIMULATION ONLY · REAL AUTHORITY FALSE</div><label className="mt-3 flex gap-2"><input type="checkbox" checked={!!confirmed.install} onChange={() => toggle('install')} />{zh ? '我确认安装此摘要；安装后保持禁用，不进入运行时。' : 'I confirm this digest; installation remains disabled and outside runtime.'}</label><button disabled={!confirmed.install || busy} type="button" onClick={() => void run(() => api()!.install(packageReview.rawPackage, true), zh ? '已安装并保持禁用。' : 'Installed and kept disabled.')} className="mt-3 border border-accent px-3 py-2 font-semibold text-accent disabled:opacity-40">{zh ? '安装（保持禁用）' : 'Install disabled'}</button></div>}
          </section>
        </div>

        <section className="mt-5 border border-border p-4">
          <h3 className="font-semibold">{zh ? '3. 已安装资产' : '3. Installed assets'}</h3>
          {(state.records ?? []).length === 0 ? <p className="mt-3 text-sm text-text-secondary">{zh ? '没有已安装包。目录不会自动下载；审阅也不会自动安装。' : 'No installed packages. The catalog never downloads automatically, and review never installs automatically.'}</p> : <div className="mt-3 grid gap-3 lg:grid-cols-2">{(state.records ?? []).map((record) => <article key={record.packageId} className="border border-border bg-surface-raised p-3">
            <div className="flex justify-between gap-3"><div><div className="font-semibold">{record.assetId}</div><div className="text-xs text-text-secondary">{record.packageId} · v{record.packageVersion}</div></div><span className={`border px-2 py-1 text-[10px] font-bold ${record.state === 'simulation_enabled' ? 'border-status-executed-edge text-status-executed-soft' : 'border-status-warning-edge text-status-warning'}`}>{record.state === 'simulation_enabled' ? 'SIMULATION ENABLED' : 'INSTALLED DISABLED'}</span></div>
            <div className="mt-2 text-xs text-text-secondary">{record.trustTier.toUpperCase()} · {record.publisherName}</div><div className="mt-1 truncate font-mono text-[10px] text-text-muted">{record.digestSha256}</div>
            {record.state === 'simulation_enabled' && <div role={workspaceBindings[record.packageId]?.ok === false ? 'alert' : undefined} className={`mt-2 border px-2 py-1.5 text-xs ${workspaceBindings[record.packageId]?.ok ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : 'border-status-warning-edge bg-status-warning-surface text-status-warning'}`}>
              {workspaceBindings[record.packageId]?.detail ?? (zh ? 'Virtual Lab 绑定尚未完成；不会静默回退。' : 'Virtual Lab binding is not ready; no fallback is used.')}
            </div>}
            {record.state === 'installed_disabled' && <><label className="mt-3 flex gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!!confirmed[`enable:${record.packageId}`]} onChange={() => toggle(`enable:${record.packageId}`)} />{zh ? '我明确启用此资产用于仿真；真机权限仍为 false。' : 'I explicitly enable this asset for simulation; real authority stays false.'}</label><button disabled={!confirmed[`enable:${record.packageId}`] || busy} type="button" onClick={() => void run(() => api()!.enableSimulation(record.packageId, true), zh ? '仿真已启用；真机权限仍为 false。' : 'Simulation enabled; real authority remains false.')} className="mt-2 text-xs font-semibold text-status-executed-soft disabled:opacity-40">{zh ? '二次确认启用仿真' : 'Second-confirm simulation'}</button></>}
            <label className="mt-3 flex gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!!confirmed[`uninstall:${record.packageId}`]} onChange={() => toggle(`uninstall:${record.packageId}`)} />{zh ? '我确认完整卸载并移除运行时可见性。' : 'I confirm complete uninstall and removal from runtime visibility.'}</label><button disabled={!confirmed[`uninstall:${record.packageId}`] || busy} type="button" onClick={() => void run(() => api()!.uninstall(record.packageId, true), zh ? '已完整卸载。' : 'Fully uninstalled.')} className="mt-2 text-xs font-semibold text-status-blocked-soft disabled:opacity-40">{zh ? '卸载' : 'Uninstall'}</button>
          </article>)}</div>}
        </section>

        <section className="mt-5 border border-border p-4" aria-labelledby="marketplace-publish-back-title">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 id="marketplace-publish-back-title" className="font-semibold">{zh ? '4. 导出改进资产提交草稿' : '4. Export improved-asset submission draft'}</h3><p className="mt-1 max-w-3xl text-xs text-text-secondary">{zh ? '选择一个已改进、版本已递增的声明式 Reality Asset。主进程重新验证后只导出本地未签名草稿；不会上传、签名、授予信任或授予真机权限。' : 'Choose an improved, version-bumped declarative Reality Asset. After main-process revalidation, this only exports a local unsigned draft; it never uploads, signs, grants trust, or grants real-hardware authority.'}</p></div><span className="border border-status-warning-edge px-2 py-1 text-[10px] font-bold text-status-warning">LOCAL DRAFT · NOT SUBMITTED</span></div>
          <button disabled={!state.ok || busy} type="button" onClick={() => void browseSubmissionAsset()} className="mt-3 border border-border bg-surface-raised px-3 py-2 text-sm font-semibold disabled:opacity-40">{zh ? '浏览改进资产 JSON…' : 'Browse improved asset JSON…'}</button>
          {submissionReview?.ok && submissionReview.summary && <div className="mt-3 border border-status-warning-edge bg-status-warning-surface p-3 text-sm">
            <div className="font-semibold text-status-warning">{submissionReview.summary.assetName} · v{submissionReview.summary.assetVersion}</div>
            <div className="mt-1 text-xs text-text-secondary">{submissionReview.summary.assetId}</div><div className="mt-1 break-all font-mono text-[10px] text-text-muted">ASSET SHA-256 {submissionReview.summary.assetDigestSha256}</div>
            <label className="mt-3 block text-xs font-semibold text-text-secondary">{zh ? '来源关系' : 'Source relationship'}<select value={submissionSource} onChange={(event) => setSubmissionSource(event.target.value)} className="mt-1 h-9 w-full border border-border bg-surface px-2 text-sm text-text-primary"><option value="new_asset">{zh ? '新资产（不声明 Marketplace 来源）' : 'New asset (no Marketplace source claim)'}</option>{(state.records ?? []).map((record) => <option key={record.packageId} value={record.packageId}>{record.packageId} · {record.assetId} · v{record.packageVersion}</option>)}</select></label>
            <label className="mt-3 block text-xs font-semibold text-text-secondary">{zh ? '改进说明（10–2000 字）' : 'Change summary (10–2000 characters)'}<textarea value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} rows={3} maxLength={2000} className="mt-1 w-full resize-y border border-border bg-surface p-2 text-sm text-text-primary" /></label>
            <div className="mt-2 text-xs font-bold text-status-warning">UNSIGNED · UNTRUSTED · NO UPLOAD · REAL AUTHORITY FALSE · hardwareSignalSent FALSE</div>
            <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={!!confirmed.submission} onChange={() => toggle('submission')} />{zh ? '我确认仅导出本地未签名草稿；仍需独立维护者审阅与签名，且不会自动上传。' : 'I confirm exporting only a local unsigned draft; independent maintainer review/signing is still required, and nothing uploads automatically.'}</label>
            <button disabled={!confirmed.submission || changeSummary.trim().length < 10 || busy} type="button" onClick={() => void exportSubmissionDraft()} className="mt-3 border border-status-warning-edge px-3 py-2 font-semibold text-status-warning disabled:opacity-40">{zh ? '导出未签名提交草稿…' : 'Export unsigned submission draft…'}</button>
          </div>}
        </section>
      </div>
    </section>
  </div>;
}
