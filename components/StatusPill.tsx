type Status = 'idle' | 'pass' | 'blocked' | 'needs_confirmation' | 'executing' | 'completed' | 'failed';
type UiLanguage = 'zh' | 'en';

const styles: Record<Status, string> = {
  idle: 'bg-white text-[#86868B] border-[#E5E5EA]',
  pass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  blocked: 'bg-rose-50 text-rose-600 border-rose-200',
  needs_confirmation: 'bg-[#EAF3FF] text-[#0066CC] border-[#BBD7F5]',
  executing: 'bg-[#EAF3FF] text-[#0066CC] border-[#BBD7F5]',
  completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  failed: 'bg-rose-50 text-rose-600 border-rose-200'
};

const labels: Record<UiLanguage, Record<Status, string>> = {
  zh: {
    idle: '\u5f85\u673a',
    pass: '\u901a\u8fc7',
    blocked: '\u5df2\u62e6\u622a',
    needs_confirmation: '\u9700\u786e\u8ba4',
    executing: '\u6267\u884c\u4e2d',
    completed: '\u5b8c\u6210',
    failed: '\u5931\u8d25'
  },
  en: {
    idle: 'IDLE',
    pass: 'PASS',
    blocked: 'BLOCKED',
    needs_confirmation: 'REVIEW',
    executing: 'RUNNING',
    completed: 'DONE',
    failed: 'FAILED'
  }
};

export function StatusPill({ status, language = 'en' }: { status: Status; language?: UiLanguage }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${styles[status]}`}>
      {labels[language][status]}
    </span>
  );
}
