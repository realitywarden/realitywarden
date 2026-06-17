'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

interface AccordionPanelProps {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  children: ReactNode;
}

export function AccordionPanel({ title, summary, defaultOpen = false, forceOpen, children }: AccordionPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const visible = forceOpen ?? open;

  return (
    <section className="overflow-hidden rounded-xl border border-panel-border bg-panel shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
      >
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-text-muted">{visible ? 'Collapse' : 'Expand'}</span>
      </button>
      {summary && <div className="border-t border-panel-border px-4 py-3 text-xs text-text-muted">{summary}</div>}
      <div className={`transition-[max-height] duration-300 ease-in-out ${visible ? 'max-h-[760px]' : 'max-h-0'} overflow-hidden`}>
        <div className="border-t border-panel-border p-4">{children}</div>
      </div>
    </section>
  );
}
