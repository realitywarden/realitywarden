'use client';

import type { UiLanguage } from './LabConfigurator';
import { t } from '@/lib/i18n';

interface FileMenuProps {
  language: UiLanguage;
  onNew: () => void;
  onOpen: () => void;
  onImportAsset: () => void;
  onImportManual: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onRestore: () => void;
}

export function FileMenu({ language, onNew, onOpen, onImportAsset, onImportManual, onSave, onSaveAs, onRestore }: FileMenuProps) {
  const items: Array<[string, () => void]> = [
    [t(language, 'app_new'), onNew],
    [t(language, 'app_open'), onOpen],
    [t(language, 'app_import_asset'), onImportAsset],
    [language === 'zh' ? '导入设备手册…' : 'Import Device Manual…', onImportManual],
    [t(language, 'app_save_project'), onSave],
    [t(language, 'app_save_as'), onSaveAs],
    [t(language, 'app_restore'), onRestore]
  ];
  return (
    <details className="relative">
      <summary className="flex h-8 cursor-pointer select-none list-none items-center border border-border bg-surface-raised px-3 text-[13px] font-semibold text-text-primary">
        {language === 'zh' ? '文件' : 'File'} <span className="ml-2 text-[10px] text-text-secondary">▾</span>
      </summary>
      <div className="rw-floating-panel absolute left-0 top-9 z-50 flex w-48 flex-col py-1">
        {items.map(([label, action]) => (
          <button key={label} type="button" onClick={(event) => { (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open'); action(); }} className="px-3 py-2 text-left text-[13px] text-text-primary hover:bg-surface-raised">
            {label}
          </button>
        ))}
      </div>
    </details>
  );
}

interface AppHeaderProps extends FileMenuProps {
  projectName: string;
  preflight: 'passed' | 'warning' | 'blocked';
  warningCount: number;
  result: 'idle' | 'running' | 'executed' | 'blocked';
  customActionCount: number;
  hasReport: boolean;
  onQuickStart: () => void;
  onActions: () => void;
  onExportReport: () => void;
  onExportAdapter: () => void;
  onLanguageChange: (language: UiLanguage) => void;
}

export function AppHeader(props: AppHeaderProps) {
  const { language, projectName, preflight, warningCount, result, customActionCount, hasReport } = props;
  const preflightClass = preflight === 'blocked' ? 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft' : preflight === 'warning' ? 'border-status-warning-edge bg-status-warning-surface text-status-warning' : 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft';
  const resultClass = result === 'blocked' ? 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft' : result === 'running' ? 'border-status-running-edge bg-status-warning-surface text-status-running' : result === 'executed' ? 'border-status-executed-edge bg-status-executed-surface text-status-executed-soft' : 'border-border bg-surface-raised text-text-secondary';
  const resultText = result === 'blocked' ? t(language, 'status_safety_blocked') : result === 'running' ? t(language, 'status_playing_motion') : result === 'executed' ? t(language, 'status_executed') : t(language, 'status_idle');
  return (
    <header data-component="AppHeader" className="flex h-12 w-full shrink-0 select-none items-center border-b border-border bg-surface">
      <div className="flex h-full w-[240px] shrink-0 items-center gap-2 border-r border-border px-3 xl:w-[280px]">
        <div className="min-w-0 flex-1"><div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">{t(language, 'app_project')}</div><div className="truncate text-[15px] font-semibold text-text-primary">{projectName}</div></div>
        <span className={`shrink-0 border px-1.5 py-0.5 text-[11px] font-semibold ${preflightClass}`}>{language === 'zh' ? preflight === 'blocked' ? '预检阻断' : preflight === 'warning' ? `${warningCount} 项警告` : '预检通过' : preflight === 'blocked' ? 'Blocked' : preflight === 'warning' ? `${warningCount} warnings` : 'Passed'}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-3">
        <nav className="flex shrink-0 items-center gap-2" aria-label={language === 'zh' ? '项目操作' : 'Project actions'}>
          <FileMenu {...props} />
          <button type="button" onClick={props.onQuickStart} className="h-8 border border-accent px-3 text-[13px] font-semibold text-accent">{t(language, 'app_quick_start')}</button>
          <button data-action-composer-trigger type="button" onClick={props.onActions} className="h-8 border border-border bg-surface-raised px-3 text-[13px] font-semibold text-text-primary">{language === 'zh' ? '自定义动作' : 'Actions'}{customActionCount ? ` (${customActionCount})` : ''}</button>
        </nav>
        <div className="flex min-w-0 items-center gap-2 border-l border-border pl-3">
          <span className={`h-7 shrink-0 border px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide ${resultClass}`}>{resultText}</span>
          <span className="h-6 w-px shrink-0 bg-border" />
          <button type="button" onClick={props.onExportReport} disabled={!hasReport} className="h-8 whitespace-nowrap border border-border bg-surface-raised px-3 text-[13px] font-semibold text-text-primary disabled:opacity-40">{t(language, 'app_export_report')}</button>
          <button type="button" onClick={props.onExportAdapter} className="h-8 whitespace-nowrap border border-accent px-3 text-[13px] font-semibold text-accent">{t(language, 'app_export_adapter_package')}</button>
          <select value={language} onChange={(event) => props.onLanguageChange(event.target.value as UiLanguage)} aria-label={language === 'zh' ? '界面语言' : 'Interface language'} className="h-8 w-20 border border-border bg-surface-raised px-2 text-[12px] text-text-primary"><option value="zh">中文</option><option value="en">English</option></select>
        </div>
      </div>
    </header>
  );
}
