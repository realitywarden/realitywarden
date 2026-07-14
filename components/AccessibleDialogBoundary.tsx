'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label: string;
  onClose: () => void;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/** Adds dialog semantics and a keyboard boundary around legacy modal content. */
export function AccessibleDialogBoundary({ children, label, onClose }: Props) {
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const controls = () => Array.from(boundaryRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((control) => control.getClientRects().length > 0);
    window.setTimeout(() => controls()[0]?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const available = controls();
      if (available.length === 0) {
        event.preventDefault();
        return;
      }
      const first = available[0];
      const last = available[available.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={boundaryRef} data-accessible-dialog-boundary className="contents" role="dialog" aria-modal="true" aria-label={label}>
      {children}
    </div>
  );
}
