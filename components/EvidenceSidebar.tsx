'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { UiLanguage } from './LabConfigurator';
import { handleRovingTabKey } from '@/lib/ui/keyboardNavigation';

type EvidenceTab = 'evidence' | 'inspector';

interface EvidenceSidebarProps {
  language: UiLanguage;
  evidence: ReactNode;
  inspector: ReactNode;
  hardware: ReactNode;
  evidenceKey: string | null;
  selectionKey: string | null;
}

export function EvidenceSidebar({
  language,
  evidence,
  inspector,
  hardware,
  evidenceKey,
  selectionKey
}: EvidenceSidebarProps) {
  const [activeTab, setActiveTab] = useState<EvidenceTab>('evidence');
  const previousSelection = useRef(selectionKey);
  const previousEvidence = useRef(evidenceKey);

  useEffect(() => {
    if (selectionKey !== previousSelection.current) {
      previousSelection.current = selectionKey;
      setActiveTab('inspector');
    }
  }, [selectionKey]);

  useEffect(() => {
    if (evidenceKey && evidenceKey !== previousEvidence.current) {
      previousEvidence.current = evidenceKey;
      setActiveTab('evidence');
    }
  }, [evidenceKey]);

  const labels = language === 'zh'
    ? { evidence: '审计与决策', inspector: '设备检查器' }
    : { evidence: 'Audit & Governor', inspector: 'Device Inspector' };

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface">
      <div className="grid h-10 shrink-0 grid-cols-2 border-b border-border bg-surface p-1" role="tablist" aria-label={language === 'zh' ? '证据侧栏' : 'Evidence sidebar'}>
        {(['evidence', 'inspector'] as EvidenceTab[]).map((tab, index, tabs) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              id={`evidence-sidebar-tab-${tab}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`evidence-sidebar-panel-${tab}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => handleRovingTabKey(event, index, tabs.length, (nextIndex) => setActiveTab(tabs[nextIndex]))}
              className={`min-w-0 border px-2 text-[13px] font-semibold transition-colors focus:outline-none ${selected ? 'border-border-strong bg-surface-raised text-text-primary' : 'border-transparent text-text-secondary hover:bg-surface-raised hover:text-text-primary'}`}
            >
              <span className="truncate">{labels[tab]}</span>
            </button>
          );
        })}
      </div>

      <div id="evidence-sidebar-panel-evidence" aria-labelledby="evidence-sidebar-tab-evidence" hidden={activeTab !== 'evidence'} className="min-h-0 flex-1 overflow-hidden" role="tabpanel">
        {evidence}
      </div>
      <div id="evidence-sidebar-panel-inspector" aria-labelledby="evidence-sidebar-tab-inspector" hidden={activeTab !== 'inspector'} className="min-h-0 flex-1 overflow-hidden" role="tabpanel">
        {inspector}
      </div>

      <div data-real-hardware-boundary className="shrink-0 border-t-4 border-real-hardware [border-image:repeating-linear-gradient(135deg,var(--color-real-hardware)_0_10px,#090A0C_10px_20px)_1]">
        {hardware}
      </div>
    </aside>
  );
}
