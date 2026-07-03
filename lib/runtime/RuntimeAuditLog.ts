export type RuntimeAuditLevel = 'info' | 'warn' | 'error';

export type RuntimeAuditStage =
  | 'input'
  | 'runtime_kernel'
  | 'autonomy'
  | 'adapter_plan'
  | 'dry_run'
  | 'execution_gate';

export interface RuntimeAuditEntry {
  id: string;
  timestamp: string;
  stage: RuntimeAuditStage;
  level: RuntimeAuditLevel;
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

function createEntry(
  stage: RuntimeAuditStage,
  level: RuntimeAuditLevel,
  code: string,
  message: string,
  data?: Record<string, unknown>
): RuntimeAuditEntry {
  return {
    id: `runtime-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    stage,
    level,
    code,
    message,
    data
  };
}

export class RuntimeAuditLog {
  private readonly entries: RuntimeAuditEntry[] = [];

  info(stage: RuntimeAuditStage, code: string, message: string, data?: Record<string, unknown>) {
    this.entries.push(createEntry(stage, 'info', code, message, data));
  }

  warn(stage: RuntimeAuditStage, code: string, message: string, data?: Record<string, unknown>) {
    this.entries.push(createEntry(stage, 'warn', code, message, data));
  }

  error(stage: RuntimeAuditStage, code: string, message: string, data?: Record<string, unknown>) {
    this.entries.push(createEntry(stage, 'error', code, message, data));
  }

  list() {
    return [...this.entries];
  }
}

