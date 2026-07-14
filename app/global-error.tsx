'use client';

import { useEffect, useRef } from 'react';

/** Last-resort boundary if the root layout itself crashes. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0F111A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div role="alert" aria-live="assertive" aria-atomic="true" style={{ maxWidth: 560, border: '1px solid #2A2E3D', background: '#181B26', padding: 24 }}>
            <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: 18, margin: 0, outline: 'none' }}>应用错误已被隔离 / App error contained</h1>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94A3B8' }}>
              界面崩溃不能证明此前的硬件传输状态。恢复后请先检查审计证据，再决定是否重试。<br />
              A UI crash does not prove prior hardware delivery state. Inspect audit evidence after recovery before retrying.
            </p>
            <pre aria-label="Error details" style={{ maxHeight: 128, overflow: 'auto', border: '1px solid #2A2E3D', background: '#0B0C0E', padding: 8, fontSize: 11, color: '#FCA5A5' }}>
              {error.message}{error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={() => reset()} style={{ height: 36, border: '1px solid #075985', background: '#0066CC', color: '#fff', padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                恢复 / Recover
              </button>
              <button type="button" onClick={() => window.location.reload()} style={{ height: 36, border: '1px solid #2A2E3D', background: 'transparent', color: '#E2E8F0', padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                重新加载 / Reload
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
