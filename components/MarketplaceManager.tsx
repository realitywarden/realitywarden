'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UiLanguage } from './LabConfigurator';

interface RecordView { packageId: string; packageVersion: string; assetId: string; trustTier: string; publisherName: string; state: 'installed_disabled' | 'simulation_enabled'; digestSha256: string }
interface TrustView { keyId: string; displayName: string; revoked: boolean }
interface StateView { ok: boolean; error?: string; quarantinedPath?: string | null; records?: RecordView[]; communityTrustEntries?: TrustView[] }
interface Review { canceled?: boolean; ok?: boolean; error?: string; rawPackage?: unknown; rawPublisher?: unknown; summary?: { packageId: string; packageVersion: string; assetId: string; assetName: string; digestSha256: string; trustTier: string; publisherName: string }; entry?: TrustView; fingerprintSha256?: string }
interface Bridge {
  state(): Promise<StateView>; browsePackage(): Promise<Review>; install(raw: unknown, confirmed: boolean): Promise<StateView>;
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

  return <div data-marketplace-modal className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
    <section className="flex max-h-[90vh] w-full max-w-5xl flex-col border border-border bg-surface shadow-2xl" aria-labelledby="marketplace-title">
      <header className="flex items-start justify-between border-b border-border bg-surface-raised px-5 py-4">
        <div><div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">SIMULATION-ONLY ASSET TRUST</div><h2 id="marketplace-title" className="mt-1 text-xl font-semibold">RealityWarden Marketplace</h2><p className="mt-1 text-sm text-text-secondary">{zh ? '签名声明式资产；安装后默认禁用，二次确认才可进入仿真。永不授予真机执行权限。' : 'Signed declarative assets. Installs default disabled; simulation needs a second confirmation. Never grants real-hardware authority.'}</p></div>
        <button type="button" onClick={onClose} className="border border-border px-3 py-1.5 text-sm">{zh ? '关闭' : 'Close'}</button>
      </header>
      <div className="min-h-0 overflow-y-auto p-5">
        {message && <div role="alert" className="mb-4 border border-status-warning-edge bg-status-warning-surface p-3 text-sm text-status-warning">{message}</div>}
        {!state.ok && <section className="mb-5 border-2 border-status-blocked-edge bg-status-blocked-surface p-4"><h3 className="font-bold text-status-blocked-soft">{desktopAvailable ? (zh ? 'Marketplace 状态已阻断' : 'Marketplace state blocked') : (zh ? '需要桌面应用' : 'Desktop app required')}</h3><p className="mt-2 break-words text-sm">{state.error}</p>{state.quarantinedPath && <p className="mt-1 break-all text-xs text-text-secondary">{state.quarantinedPath}</p>}{desktopAvailable && <><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={!!confirmed.reset} onChange={() => toggle('reset')} />{zh ? '我确认丢弃损坏状态并创建空白状态；不会静默修复或降级。' : 'I confirm discarding corrupt state and creating an empty state; nothing is silently repaired or downgraded.'}</label><button disabled={!confirmed.reset || busy} type="button" onClick={() => void run(() => api()!.resetState(true), zh ? '已显式重置。' : 'Explicitly reset.')} className="mt-3 border border-status-blocked-edge px-3 py-2 text-sm font-semibold text-status-blocked-soft disabled:opacity-40">{zh ? '重置空白状态' : 'Reset to empty state'}</button></>}</section>}

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
          {(state.records ?? []).length === 0 ? <p className="mt-3 text-sm text-text-secondary">{zh ? '没有已安装包。当前无网络目录，也不会静默下载。' : 'No installed packages. There is no network catalog and nothing downloads silently.'}</p> : <div className="mt-3 grid gap-3 lg:grid-cols-2">{(state.records ?? []).map((record) => <article key={record.packageId} className="border border-border bg-surface-raised p-3">
            <div className="flex justify-between gap-3"><div><div className="font-semibold">{record.assetId}</div><div className="text-xs text-text-secondary">{record.packageId} · v{record.packageVersion}</div></div><span className={`border px-2 py-1 text-[10px] font-bold ${record.state === 'simulation_enabled' ? 'border-status-executed-edge text-status-executed-soft' : 'border-status-warning-edge text-status-warning'}`}>{record.state === 'simulation_enabled' ? 'SIMULATION ENABLED' : 'INSTALLED DISABLED'}</span></div>
            <div className="mt-2 text-xs text-text-secondary">{record.trustTier.toUpperCase()} · {record.publisherName}</div><div className="mt-1 truncate font-mono text-[10px] text-text-muted">{record.digestSha256}</div>
            {record.state === 'simulation_enabled' && <div role={workspaceBindings[record.packageId]?.ok === false ? 'alert' : undefined} className={`mt-2 border px-2 py-1.5 text-xs ${workspaceBindings[record.packageId]?.ok ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : 'border-status-warning-edge bg-status-warning-surface text-status-warning'}`}>
              {workspaceBindings[record.packageId]?.detail ?? (zh ? 'Virtual Lab 绑定尚未完成；不会静默回退。' : 'Virtual Lab binding is not ready; no fallback is used.')}
            </div>}
            {record.state === 'installed_disabled' && <><label className="mt-3 flex gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!!confirmed[`enable:${record.packageId}`]} onChange={() => toggle(`enable:${record.packageId}`)} />{zh ? '我明确启用此资产用于仿真；真机权限仍为 false。' : 'I explicitly enable this asset for simulation; real authority stays false.'}</label><button disabled={!confirmed[`enable:${record.packageId}`] || busy} type="button" onClick={() => void run(() => api()!.enableSimulation(record.packageId, true), zh ? '仿真已启用；真机权限仍为 false。' : 'Simulation enabled; real authority remains false.')} className="mt-2 text-xs font-semibold text-status-executed-soft disabled:opacity-40">{zh ? '二次确认启用仿真' : 'Second-confirm simulation'}</button></>}
            <label className="mt-3 flex gap-2 text-xs text-text-secondary"><input type="checkbox" checked={!!confirmed[`uninstall:${record.packageId}`]} onChange={() => toggle(`uninstall:${record.packageId}`)} />{zh ? '我确认完整卸载并移除运行时可见性。' : 'I confirm complete uninstall and removal from runtime visibility.'}</label><button disabled={!confirmed[`uninstall:${record.packageId}`] || busy} type="button" onClick={() => void run(() => api()!.uninstall(record.packageId, true), zh ? '已完整卸载。' : 'Fully uninstalled.')} className="mt-2 text-xs font-semibold text-status-blocked-soft disabled:opacity-40">{zh ? '卸载' : 'Uninstall'}</button>
          </article>)}</div>}
        </section>
      </div>
    </section>
  </div>;
}
