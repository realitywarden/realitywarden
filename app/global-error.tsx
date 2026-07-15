'use client';

import { StartupFailureView } from '@/components/startup/StartupFailureView';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const language = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return (
    <html lang="en">
      <body className="rw-startup-viewport"><StartupFailureView error={error} reset={reset} reload={() => window.location.reload()} language={language} /></body>
    </html>
  );
}
