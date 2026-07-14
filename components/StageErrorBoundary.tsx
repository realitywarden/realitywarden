'use client';

import { Component, Fragment, createRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Error boundary dedicated to the 3D workspace stage. WebGL / three.js
 * failures (context loss, bad geometry, driver quirks) must degrade to a
 * recoverable panel instead of taking down the whole app. Safety layers are
 * untouched by any render error.
 */
export class StageErrorBoundary extends Component<
  { language: 'zh' | 'en'; children: ReactNode },
  { error: Error | null; revision: number }
> {
  state = { error: null as Error | null, revision: 0 };
  private readonly headingRef = createRef<HTMLHeadingElement>();

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(_previousProps: Readonly<{ language: 'zh' | 'en'; children: ReactNode }>, previousState: Readonly<{ error: Error | null; revision: number }>) {
    if (!previousState.error && this.state.error) this.headingRef.current?.focus();
  }

  render() {
    const { language, children } = this.props;
    if (!this.state.error) return <Fragment key={this.state.revision}>{children}</Fragment>;
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#232529]">
        <div className="max-w-[480px] border border-[#313338] bg-[#1E1F22] p-4 text-center" role="alert" aria-live="assertive" aria-atomic="true">
          <h2 ref={this.headingRef} tabIndex={-1} className="text-[13px] font-bold uppercase tracking-wide text-[#FCA5A5] outline-none">
            {language === 'zh' ? '3D 工作区渲染出错' : '3D workspace failed to render'}
          </h2>
          <div className="mt-2 text-[13px] leading-5 text-[#949BA4]">
            {language === 'zh'
              ? '渲染错误不会绕过安全门，但不能证明此前的硬件传输状态。重新加载工作区后，请先检查右侧审计证据再重试真实命令。'
              : 'A render error cannot bypass the safety gate, but it does not prove prior hardware delivery state. After reloading the workspace, inspect audit evidence before retrying a real command.'}
          </div>
          <div className="mt-2 max-h-20 overflow-auto border border-[#313338] bg-[#0B0C0E] p-1.5 text-left font-mono text-[11px] text-[#FCA5A5]" aria-label={language === 'zh' ? '错误详情' : 'Error details'}>
            {this.state.error.message}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => this.setState((state) => ({ error: null, revision: state.revision + 1 }))}
              className="h-8 border border-[#075985] bg-[#0066CC] px-3 text-[13px] font-semibold text-white hover:bg-[#0A74DA]"
            >
              {language === 'zh' ? '重新加载 3D 工作区' : 'Reload 3D workspace'}
            </button>
            <button type="button" onClick={() => window.location.reload()} className="h-8 border border-[#313338] px-3 text-[13px] font-semibold text-[#E2E8F0] hover:bg-[#2B2D31]">
              {language === 'zh' ? '重新加载应用' : 'Reload app'}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
