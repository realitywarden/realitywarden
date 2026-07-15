'use client';

import { useState } from 'react';

export function StartupDetails({ detail, language }: { detail: string; language: 'zh' | 'en' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(detail);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const area = document.createElement('textarea');
      area.value = detail;
      document.body.append(area);
      area.select();
      document.execCommand('copy');
      area.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };
  return (
    <div className="rw-startup-details-wrap">
      <button type="button" className="rw-startup-details-toggle" aria-expanded={open} aria-controls="rw-startup-error-detail" onClick={() => setOpen((value) => !value)}>
        {open ? (language === 'zh' ? '收起详情' : 'Hide details') : (language === 'zh' ? '显示详情' : 'Show details')}
      </button>
      {open ? (
        <div id="rw-startup-error-detail" className="rw-startup-details">
          <button type="button" className="rw-startup-copy" onClick={() => void copy()}>{copied ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制错误' : 'Copy error')}</button>
          {detail}
        </div>
      ) : null}
    </div>
  );
}
