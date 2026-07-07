/**
 * Compiler orchestration: try the LLM first, fall back to the rule engine —
 * EXPLICITLY and visibly (docs/LLM_COMPILER_DRAFT.md). The caller always
 * learns which compiler produced the TaskDSL and why a fallback happened;
 * nothing is ever silently substituted.
 *
 * Downstream safety (Runtime Kernel, AutonomyCore, SafetyRuntime,
 * SafetyMonitor) is unchanged and applies identically to both compilers.
 */
import type { DeviceMeta } from '@/types/deviceMeta';
import type { TaskDSL } from '@/types/taskDsl';
import { compilePromptToTaskDSL } from '../mockTaskCompiler';
import { LlmTaskCompiler } from './LlmTaskCompiler';
import type { LlmCompileFailure } from './LlmTaskCompiler';

export interface CompileWithFallbackResult {
  taskDsl: TaskDSL;
  /** Which compiler actually produced the TaskDSL. */
  compiler: 'llm' | 'rules';
  model?: string;
  elapsedMs: number;
  /** Present when the rule engine ran because the LLM path failed. */
  fallbackReason?: LlmCompileFailure;
  fallbackDetail?: string;
  /** Raw LLM output (also on failure) for the audit trail. */
  llmRaw?: string;
}

export async function compileTaskDslWithFallback(
  prompt: string,
  deviceMeta: DeviceMeta,
  llm: LlmTaskCompiler = new LlmTaskCompiler()
): Promise<CompileWithFallbackResult> {
  const started = Date.now();
  const llmResult = await llm.compile(prompt, deviceMeta);
  if (llmResult.ok && llmResult.taskDsl) {
    return {
      taskDsl: llmResult.taskDsl,
      compiler: 'llm',
      model: llmResult.model,
      elapsedMs: Date.now() - started,
      llmRaw: llmResult.raw
    };
  }
  const rulesTaskDsl = compilePromptToTaskDSL(prompt, deviceMeta.device_type);
  return {
    taskDsl: rulesTaskDsl,
    compiler: 'rules',
    model: llmResult.model,
    elapsedMs: Date.now() - started,
    fallbackReason: llmResult.failure,
    fallbackDetail: llmResult.failureDetail,
    llmRaw: llmResult.raw
  };
}
