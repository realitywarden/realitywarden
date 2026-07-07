'use client';

import { Component } from 'react';
import type { ReactNode } from 'react';

/**
 * Error boundary dedicated to the 3D workspace stage. WebGL / three.js
 * failures (context loss, bad geometry, driver quirks) must degrade to a
 * recoverable panel instead of taking down the whole app. Safety layers are
 * untouched by any render error.
 */
export class StageErrorBoundary extends Component<
  { language: 'zh' | 'en'; children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { language, children } = this.props;
    if (!this.state.error) return children;
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#232529]">
        <div className="max-w-[420px] border border-[#313338] bg-[#1E1F22] p-4 text-center">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#FCA5A5]">
            {language === 'zh' ? '3D 工作区渲染出错' : '3D workspace failed to render'}
          </div>
          <div className="mt-2 text-[13px] leading-5 text-[#949BA4]">
            {language === 'zh'
              ? '仿真与安全层不受影响，未向真实硬件发送任何信号。'
              : 'Simulation and safety layers are unaffected. Nothing was sent to real hardware.'}
          </div>
          <div className="mt-2 max-h-20 overflow-auto border border-[#313338] bg-[#0B0C0E] p-1.5 text-left font-mono text-[11px] text-[#FCA5A5]">
            {this.state.error.message}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 h-8 border border-[#075985] bg-[#0066CC] px-3 text-[13px] font-semibold text-white hover:bg-[#0A74DA]"
          >
            {language === 'zh' ? '重新加载工作区' : 'Reload workspace'}
          </button>
        </div>
      </div>
    );
  }
}
