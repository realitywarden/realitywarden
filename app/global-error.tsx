'use client';

/** Last-resort boundary if the root layout itself crashes. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0F111A', color: '#E2E8F0', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: 520, border: '1px solid #2A2E3D', background: '#181B26', padding: 24 }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>应用崩溃已被拦下 / The app crashed and was contained</h1>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#94A3B8' }}>
              未向真实硬件发送任何信号。No signals were sent to real hardware.
            </p>
            <pre style={{ maxHeight: 128, overflow: 'auto', border: '1px solid #2A2E3D', background: '#0B0C0E', padding: 8, fontSize: 11, color: '#FCA5A5' }}>
              {error.message}
            </pre>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 16, height: 36, border: '1px solid #075985', background: '#0066CC', color: '#fff', padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              恢复 / Recover
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
