'use client';

/**
 * Route-level error boundary: a crash anywhere in the page must never leave
 * the user staring at a blank screen. Bilingual, with a one-click recovery.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#0F111A] text-[#E2E8F0]">
      <div className="max-w-[520px] border border-[#2A2E3D] bg-[#181B26] p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FCA5A5]">Runtime UI Error</div>
        <h1 className="mt-2 text-[18px] font-semibold">界面遇到错误，已被安全拦下 / The UI hit an error and was contained</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#94A3B8]">
          仿真与安全层不受影响：本工具不向真实硬件发送任何未经审计的信号。点击下方按钮恢复界面；
          若反复出现，请附上下面的错误信息反馈。
          <br />
          Simulation and safety layers are unaffected — nothing was sent to real hardware. Click below to recover;
          if this repeats, please report the message.
        </p>
        <pre className="mt-3 max-h-32 overflow-auto border border-[#2A2E3D] bg-[#0B0C0E] p-2 font-mono text-[11px] leading-4 text-[#FCA5A5]">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 h-9 border border-[#075985] bg-[#0066CC] px-4 text-[13px] font-semibold text-white hover:bg-[#0A74DA]"
        >
          恢复界面 / Recover
        </button>
      </div>
    </div>
  );
}
