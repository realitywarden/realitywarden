import type { AdapterDryRunResult, AdapterPlan, AdapterPlanValidationResult, AdapterSdkBoundary } from '@/lib/adapter-sdk';
import type { AutonomyResult } from '@/lib/autonomy-core/AutonomyResult';
import type { OpenRealityTaskDSL, OpenRealityRuntimeResult, RuntimeDecisionStatus } from '@/lib/open-reality-runtime/types';
import type { RuntimeAuditEntry } from './RuntimeAuditLog';

export interface LocalRuntimeSession {
  sessionId: string;
  status: RuntimeDecisionStatus | 'proposed_plan';
  reason: string;
  userFacingMessage: string;
  runtimeResult: OpenRealityRuntimeResult;
  autonomyResult: AutonomyResult | null;
  executableTaskDsl: OpenRealityTaskDSL | null;
  adapterBoundary: AdapterSdkBoundary | null;
  adapterPlan: AdapterPlan | null;
  adapterPlanValidation: AdapterPlanValidationResult | null;
  adapterDryRun: AdapterDryRunResult | null;
  /** Which compiler produced the language understanding for this session. */
  compilerUsed: 'llm' | 'rules';
  /** Human-readable provenance, e.g. "llm(qwen2.5:3b) in 1240ms". */
  compilerDetail: string;
  auditLog: RuntimeAuditEntry[];
  canExecute: boolean;
}

