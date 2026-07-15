'use client';

import { StartupFailureView } from '@/components/startup/StartupFailureView';

/** Route-level renderer failures reuse the startup recovery language so the
 * desktop never falls back to an unrelated blue/white error surface. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const language = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return (
    <div className="rw-startup-viewport">
      <StartupFailureView error={error} reset={reset} reload={() => window.location.reload()} language={language} />
    </div>
  );
}
