import type { ReactNode } from 'react';
import type { OpenRealityRuntimeResult, RuntimeDecisionStatus } from '@/lib/open-reality-runtime/types';
import { localizeCapability, localizeDeviceType } from '@/lib/i18n';
import type { UiLanguage } from './LabConfigurator';

interface AutonomyDecisionPanelProps {
  language: UiLanguage;
  prompt: string;
  targetDeviceLabel: string;
  targetDeviceType: string;
  decision: OpenRealityRuntimeResult | null;
}

type PipelineState = 'pending' | 'processing' | 'pass' | 'blocked' | 'warning';

interface PipelineStep {
  id: string;
  label: string;
  detail: string;
  state: PipelineState;
  evidence?: string;
}

const copy = {
  zh: {
    title: 'Runtime Governor',
    subtitle: 'AI 指令拦截与仿真授权流水线',
    boundary: 'AIRGAPPED · SIMULATION ONLY',
    idle: '等待 AI Command。运行后这里会显示系统理解了什么、检查了什么、为什么允许或拦截。',
    latest: '当前拦截记录',
    userPrompt: '\u7528\u6237\u6307\u4ee4',
    targetDevice: '\u76ee\u6807\u8bbe\u5907',
    runtimeStatus: '\u8fd0\u884c\u65f6\u72b6\u6001',
    executionMode: '\u6267\u884c\u6a21\u5f0f',
    goal: '\u4efb\u52a1\u76ee\u6807',
    requiredCapabilities: '\u6240\u9700\u80fd\u529b',
    missingCapabilities: '\u7f3a\u5931\u80fd\u529b',
    reason: '\u539f\u56e0',
    message: '\u7528\u6237\u63d0\u793a',
    payload: 'TaskDSL \u9884\u89c8',
    emptyPayload: '非 compiled 状态不会生成可执行 TaskDSL。',
    none: '\u65e0',
    compiled: '\u5df2\u7f16\u8bd1',
    blocked: '\u5df2\u62e6\u622a',
    unsupported: '\u4e0d\u652f\u6301',
    ambiguous: '\u6307\u4ee4\u542b\u7cca',
    notRunnable: '\u4e0d\u53ef\u8fd0\u884c',
    askHuman: '\u8bf7\u4eba\u5de5\u786e\u8ba4',
    simulationOnly: '\u4ec5\u4eff\u771f',
    readOnly: '\u53ea\u8bfb',
    approvalRequired: '\u9700\u4eba\u5de5\u6279\u51c6',
    blockedMode: '\u5df2\u62e6\u622a',
    steps: {
      intent: '\u610f\u56fe\u89e3\u6790',
      capability: '\u80fd\u529b\u6838\u9a8c',
      world: '\u4e16\u754c\u72b6\u6001\u68c0\u67e5',
      simulation: '\u4eff\u771f\u8fb9\u754c',
      safety: '\u5b89\u5168\u6cbb\u7406\u5668',
      decision: '\u8fd0\u884c\u65f6\u88c1\u51b3'
    },
    details: {
      intent: '自然语言被转换为目标和风险提示。',
      capability: '目标设备能力与任务需求对齐。',
      world: '检查工作区、对象和安全区域。',
      simulation: '确认当前只允许仿真或只读执行。',
      safety: '安全治理器决定允许、阻止或要求人工确认。',
      decision: '只有 compiled 才进入仿真执行链路。'
    }
  },
  en: {
    title: 'Runtime Governor',
    subtitle: 'AI command interception and simulation authorization',
    boundary: 'AIRGAPPED · SIMULATION ONLY',
    idle: 'Waiting for AI Command. After Run, this panel shows what the system understood, what it checked, and why it allowed or blocked the request.',
    latest: 'Current Interception Record',
    userPrompt: 'User Prompt',
    targetDevice: 'Target Device',
    runtimeStatus: 'Runtime Status',
    executionMode: 'Execution Mode',
    goal: 'Goal',
    requiredCapabilities: 'Required Capabilities',
    missingCapabilities: 'Missing Capabilities',
    reason: 'Reason',
    message: 'User Message',
    payload: 'TaskDSL Preview',
    emptyPayload: 'Non-compiled decisions do not generate executable TaskDSL.',
    none: 'None',
    compiled: 'Compiled',
    blocked: 'Blocked',
    unsupported: 'Unsupported',
    ambiguous: 'Ambiguous',
    notRunnable: 'Not Runnable',
    askHuman: 'Ask Human',
    simulationOnly: 'Simulation Only',
    readOnly: 'Read Only',
    approvalRequired: 'Human Approval Required',
    blockedMode: 'Blocked',
    steps: {
      intent: 'Intent Parsed',
      capability: 'Capabilities Verified',
      world: 'World State Checked',
      simulation: 'Simulation Boundary',
      safety: 'Safety Governor',
      decision: 'Runtime Decision'
    },
    details: {
      intent: 'Natural language is converted into a goal and risk hint.',
      capability: 'Target device capabilities are checked against the task.',
      world: 'Workspace, objects, and safety zones are evaluated.',
      simulation: 'The request is constrained to simulation or read-only execution.',
      safety: 'The Safety Governor allows, blocks, or asks for human approval.',
      decision: 'Only compiled decisions continue into the simulation flow.'
    }
  }
} as const;

function localStatus(language: UiLanguage, status: RuntimeDecisionStatus) {
  const t = copy[language];
  if (status === 'compiled') return t.compiled;
  if (status === 'blocked') return t.blocked;
  if (status === 'unsupported') return t.unsupported;
  if (status === 'ambiguous') return t.ambiguous;
  if (status === 'not_runnable') return t.notRunnable;
  return t.askHuman;
}

function localExecutionMode(language: UiLanguage, decision: OpenRealityRuntimeResult) {
  const t = copy[language];
  if (decision.taskDsl?.humanApprovalRequired) return t.approvalRequired;
  if (decision.taskDsl?.executionMode === 'read_only') return t.readOnly;
  if (decision.taskDsl?.executionMode === 'simulation_only') return t.simulationOnly;
  if (decision.safetyDecision.safetyEnvelope.allowedExecutionMode === 'read_only') return t.readOnly;
  if (decision.safetyDecision.safetyEnvelope.allowedExecutionMode === 'simulation_only') return t.simulationOnly;
  if (decision.safetyDecision.safetyEnvelope.allowedExecutionMode === 'ask_human') return t.approvalRequired;
  return t.blockedMode;
}

function statusClass(status: RuntimeDecisionStatus | null) {
  if (status === 'compiled') return 'border-[#14532D] bg-status-executed-surface text-[#86EFAC]';
  if (status === 'blocked') return 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft';
  if (status === 'ask_human' || status === 'ambiguous' || status === 'unsupported' || status === 'not_runnable') {
    return 'border-status-warning-edge bg-status-warning-surface text-status-warning';
  }
  return 'border-[#313338] bg-[#181A1D] text-[#9AA3AF]';
}

function stepClass(state: PipelineState) {
  if (state === 'pass') return 'border-[#14532D] bg-status-executed-surface text-[#86EFAC]';
  if (state === 'blocked') return 'border-status-blocked-edge bg-status-blocked-surface text-status-blocked-soft';
  if (state === 'warning') return 'border-status-warning-edge bg-status-warning-surface text-status-warning';
  if (state === 'processing') return 'border-[#075985] bg-[#0B2233] text-[#7DD3FC]';
  return 'border-[#313338] bg-[#111214] text-[#6B7280]';
}

function stepMark(state: PipelineState) {
  if (state === 'pass') return 'PASS';
  if (state === 'blocked') return 'STOP';
  if (state === 'warning') return 'HOLD';
  if (state === 'processing') return 'RUN';
  return 'WAIT';
}

function buildPipeline(language: UiLanguage, decision: OpenRealityRuntimeResult | null): PipelineStep[] {
  const t = copy[language];
  const base: PipelineStep[] = [
    { id: 'intent', label: t.steps.intent, detail: t.details.intent, state: decision ? 'pass' : 'pending' },
    { id: 'capability', label: t.steps.capability, detail: t.details.capability, state: decision ? 'pass' : 'pending' },
    { id: 'world', label: t.steps.world, detail: t.details.world, state: decision ? 'pass' : 'pending' },
    { id: 'simulation', label: t.steps.simulation, detail: t.details.simulation, state: decision ? 'pass' : 'pending' },
    { id: 'safety', label: t.steps.safety, detail: t.details.safety, state: decision ? 'pass' : 'pending' },
    { id: 'decision', label: t.steps.decision, detail: t.details.decision, state: decision ? 'processing' : 'pending' }
  ];

  if (!decision) return base;

  if (decision.status === 'compiled') {
    return base.map((step) => ({
      ...step,
      state: 'pass',
      evidence: step.id === 'decision' ? decision.reason : undefined
    }));
  }

  if (decision.status === 'blocked') {
    return base.map((step) => {
      if (step.id === 'safety' || step.id === 'decision') return { ...step, state: 'blocked', evidence: decision.reason };
      return { ...step, state: 'pass' };
    });
  }

  if (decision.status === 'unsupported' || decision.status === 'not_runnable') {
    return base.map((step) => {
      if (step.id === 'capability' || step.id === 'decision') return { ...step, state: 'blocked', evidence: decision.reason };
      if (step.id === 'intent') return { ...step, state: 'pass' };
      return { ...step, state: 'pending' };
    });
  }

  if (decision.status === 'ambiguous') {
    return base.map((step) => {
      if (step.id === 'intent' || step.id === 'decision') return { ...step, state: 'warning', evidence: decision.reason };
      return { ...step, state: 'pending' };
    });
  }

  return base.map((step) => {
    if (step.id === 'safety' || step.id === 'decision') return { ...step, state: 'warning', evidence: decision.reason };
    return { ...step, state: 'pass' };
  });
}

function kv(label: string, value: ReactNode) {
  return (
    <div className="grid grid-cols-[112px_1fr] gap-x-3 border-t border-white/5 py-2 first:border-t-0">
      <div className="text-[11px] font-bold uppercase tracking-wide text-[#86868B]">{label}</div>
      <div className="min-w-0 text-[11px] leading-5 text-[#DBDEE1]">{value}</div>
    </div>
  );
}

export function AutonomyDecisionPanel({
  language,
  prompt,
  targetDeviceLabel,
  targetDeviceType,
  decision
}: AutonomyDecisionPanelProps) {
  const t = copy[language];
  const pipeline = buildPipeline(language, decision);
  const payloadPreview = decision?.taskDsl
    ? JSON.stringify({
        targetDeviceId: decision.taskDsl.targetDeviceId,
        goalType: decision.taskDsl.goalType,
        executionMode: decision.taskDsl.executionMode,
        humanApprovalRequired: Boolean(decision.taskDsl.humanApprovalRequired),
        steps: decision.taskDsl.steps.map((step) => ({
          action: step.action,
          target: step.target,
          capabilityId: step.capabilityId
        }))
      }, null, 2)
    : null;

  return (
    <section className="flex h-full min-h-0 flex-col border-b border-border-panel bg-[#101114]">
      <div className="border-b border-border-panel bg-[#15171A] px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#7DD3FC]">{t.title}</div>
            <div className="mt-0.5 text-[11px] leading-4 text-[#9AA3AF]">{t.subtitle}</div>
          </div>
          <span className="shrink-0 rounded-[3px] border border-status-warning-edge bg-status-warning-surface px-2 py-1 font-mono text-[11px] font-bold tracking-wide text-status-warning">
            {t.boundary}
          </span>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {!decision ? (
          <div className="mb-2 rounded-[3px] border border-dashed border-[#313338] bg-[#0B0C0E] px-3 py-2 text-[11px] leading-5 text-[#9AA3AF]">
            {t.idle}
          </div>
        ) : (
          <div className="mb-2 rounded-[3px] border border-[#313338] bg-[#0B0C0E] px-3 py-1">
            {kv(t.userPrompt, <span className="font-mono text-[#E6EAF0]">{prompt || '-'}</span>)}
            {kv(t.targetDevice, (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{targetDeviceLabel}</span>
                <span className="rounded-[3px] border border-[#313338] bg-[#181A1D] px-1.5 py-0.5 text-[11px] text-[#9AA3AF]">
                  {localizeDeviceType(language, targetDeviceType)}
                </span>
              </div>
            ))}
            {kv(t.runtimeStatus, (
              <span className={`inline-flex rounded-[3px] border px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusClass(decision.status)}`}>
                {localStatus(language, decision.status)}
              </span>
            ))}
            {kv(t.goal, <span className="font-mono">{decision.goal.goalType}</span>)}
            {kv(t.executionMode, localExecutionMode(language, decision))}
            {kv(t.requiredCapabilities, decision.plan.requiredCapabilities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {decision.plan.requiredCapabilities.map((capability) => (
                  <span key={capability} className="rounded-[3px] border border-[#075985] bg-[#0B2233] px-1.5 py-0.5 text-[11px] text-[#9BD4FF]">
                    {localizeCapability(language, capability)}
                  </span>
                ))}
              </div>
            ) : <span className="text-[#6B7280]">{t.none}</span>)}
            {kv(t.missingCapabilities, decision.plan.missingCapabilities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {decision.plan.missingCapabilities.map((capability) => (
                  <span key={capability} className="rounded-[3px] border border-status-blocked-edge bg-status-blocked-surface px-1.5 py-0.5 text-[11px] text-status-blocked-soft">
                    {localizeCapability(language, capability)}
                  </span>
                ))}
              </div>
            ) : <span className="text-[#6B7280]">{t.none}</span>)}
            {kv(t.reason, <span className="font-mono text-[#9AA3AF]">{decision.reason}</span>)}
            {kv(t.message, decision.userFacingMessage)}
          </div>
        )}

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#86868B]">{t.latest}</div>
        <div className="grid gap-1.5">
          {pipeline.map((step, index) => (
            <div key={step.id} className={`rounded-[3px] border px-2.5 py-2 ${stepClass(step.state)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-[#86868B]">{String(index + 1).padStart(2, '0')}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide">{step.label}</span>
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-[#9AA3AF]">{step.detail}</div>
                  {step.evidence && (
                    <div className="mt-1 border-l border-current/30 pl-2 font-mono text-[11px] leading-4 text-current">
                      {step.evidence}
                    </div>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] font-bold">{stepMark(step.state)}</span>
              </div>
            </div>
          ))}
        </div>

        <details className="mt-2 rounded-[3px] border border-[#313338] bg-[#0B0C0E]">
          <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#86868B]">
            {t.payload}
          </summary>
          <pre className="custom-scrollbar max-h-40 overflow-auto border-t border-[#313338] p-2 font-mono text-[11px] leading-4 text-[#9AA3AF]">
            {payloadPreview ?? t.emptyPayload}
          </pre>
        </details>
      </div>
    </section>
  );
}
