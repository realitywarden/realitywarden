'use client';

import type { UiLanguage } from './LabConfigurator';

export type OperatorNoticeSeverity = 'info' | 'success' | 'warning' | 'error';
export type OperatorNoticeAction =
  | 'discard_autosave'
  | 'retry_autosave'
  | 'retry_project_save'
  | 'retry_project_save_as'
  | 'retry_project_open'
  | 'choose_project_file'
  | 'retry_export_adapter'
  | 'retry_export_report'
  | 'retry_export_asset';

export interface OperatorNoticeState {
  id: number;
  severity: OperatorNoticeSeverity;
  message: string;
  persistent?: boolean;
  action?: {
    kind: OperatorNoticeAction;
    label: string;
  };
}

interface Props {
  language: UiLanguage;
  notice: OperatorNoticeState;
  onDismiss: () => void;
  onAction: (action: OperatorNoticeAction) => void;
}

const severityClass: Record<OperatorNoticeSeverity, string> = {
  info: 'border-accent text-accent',
  success: 'border-status-executed-edge text-status-executed-soft',
  warning: 'border-status-warning-edge text-status-warning',
  error: 'border-status-blocked-edge text-status-blocked-soft'
};

function severityLabel(language: UiLanguage, severity: OperatorNoticeSeverity) {
  const labels = language === 'zh'
    ? { info: '信息', success: '成功', warning: '警告', error: '错误' }
    : { info: 'Info', success: 'Success', warning: 'Warning', error: 'Error' };
  return labels[severity];
}

export function OperatorNotice({ language, notice, onDismiss, onAction }: Props) {
  const urgent = notice.severity === 'error' || notice.severity === 'warning';
  return (
    <div
      className={`pointer-events-auto fixed left-1/2 top-12 z-[80] flex w-[min(520px,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 border bg-surface-overlay px-3 py-2 [box-shadow:var(--shadow-floating)] backdrop-blur-sm ${severityClass[notice.severity]}`}
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      data-operator-notice={notice.severity}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em]">
          {severityLabel(language, notice.severity)}
        </div>
        <div className="mt-0.5 break-words text-[13px] font-semibold leading-5 text-text-primary">
          {notice.message}
        </div>
        {notice.action && (
          <button
            type="button"
            onClick={() => onAction(notice.action!.kind)}
            className="mt-2 h-8 border border-current px-3 text-[12px] font-semibold hover:bg-surface-raised"
          >
            {notice.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="h-8 shrink-0 border border-border px-2 text-[12px] font-semibold text-text-secondary hover:bg-surface-raised hover:text-text-primary"
        aria-label={language === 'zh' ? '关闭通知' : 'Dismiss notification'}
      >
        {language === 'zh' ? '关闭' : 'Dismiss'}
      </button>
    </div>
  );
}
