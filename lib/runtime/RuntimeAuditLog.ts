export type RuntimeAuditLevel = 'info' | 'warn' | 'error';

export type RuntimeAuditStage =
  | 'input'
  | 'runtime_kernel'
  | 'autonomy'
  | 'adapter_plan'
  | 'dry_run'
  | 'execution_gate'
  | 'hardware';

export interface RuntimeAuditEntry {
  id: string;
  timestamp: string;
  stage: RuntimeAuditStage;
  level: RuntimeAuditLevel;
  code: string;
  message: string;
  /**
   * REQUIRED on every entry. True ONLY when a signal actually left the host
   * toward real hardware for this entry. Blocked decisions are always false.
   * Simulation-only entries are always false.
   */
  hardwareSignalSent: boolean;
  data?: Record<string, unknown>;
}

function createEntry(
  stage: RuntimeAuditStage,
  level: RuntimeAuditLevel,
  code: string,
  message: string,
  data?: Record<string, unknown>,
  hardwareSignalSent = false
): RuntimeAuditEntry {
  return {
    id: `runtime-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    stage,
    level,
    code,
    message,
    hardwareSignalSent,
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

  /**
   * Record an allow/block execution decision. Unlike info/warn/error this
   * requires an explicit hardwareSignalSent value so hardware execution paths
   * can never forget to declare whether a signal reached the device.
   */
  decision(
    stage: RuntimeAuditStage,
    level: RuntimeAuditLevel,
    code: string,
    message: string,
    hardwareSignalSent: boolean,
    data?: Record<string, unknown>
  ) {
    this.entries.push(createEntry(stage, level, code, message, data, hardwareSignalSent));
  }

  list() {
    return [...this.entries];
  }

  /** Export the full audit log as pretty-printed JSON. */
  exportJson(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
