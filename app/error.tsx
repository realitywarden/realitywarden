'use client';

import { useEffect, useRef } from 'react';

/**
 * Route-level error boundary: a crash anywhere in the page must never leave
 * the user staring at a blank screen. Bilingual, with a one-click recovery.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0F111A] text-[#E2E8F0]">
      <div className="max-w-[560px] border border-[#2A2E3D] bg-[#181B26] p-6" role="alert" aria-live="assertive" aria-atomic="true">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FCA5A5]">Runtime UI Error</div>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-[18px] font-semibold outline-none">界面错误已被隔离 / UI error contained</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#94A3B8]">
          界面错误不会绕过安全门，但它不能证明真实硬件是否已收到此前的命令。恢复后请先检查审计证据，
          不要因界面异常自动重试真实命令。若恢复反复失败，可重新加载应用并恢复自动保存。
          <br />
          A UI error cannot bypass the safety gate, but it does not prove whether hardware received an earlier command.
          After recovery, inspect audit evidence before retrying any real command. Reload the app if recovery repeats.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto border border-[#2A2E3D] bg-[#0B0C0E] p-2 font-mono text-[11px] leading-4 text-[#FCA5A5]" aria-label="Error details">
          {error.message}{error.digest ? `\nDigest: ${error.digest}` : ''}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => reset()} className="h-9 border border-[#075985] bg-[#0066CC] px-4 text-[13px] font-semibold text-white hover:bg-[#0A74DA]">
            恢复界面 / Recover
          </button>
          <button type="button" onClick={() => window.location.reload()} className="h-9 border border-[#2A2E3D] px-4 text-[13px] font-semibold text-[#E2E8F0] hover:bg-[#232838]">
            重新加载应用 / Reload app
          </button>
        </div>
      </div>
    </div>
  );
}
