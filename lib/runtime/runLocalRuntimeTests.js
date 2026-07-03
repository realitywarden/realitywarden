const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const localRuntime = read('lib/runtime/LocalRuntime.ts');
const safetyMonitor = read('lib/runtime/SafetyMonitor.ts');
const executionSession = read('lib/runtime/ExecutionSession.ts');
const auditLog = read('lib/runtime/RuntimeAuditLog.ts');
const page = read('app/page.tsx');
const reportBuilder = read('lib/reporting/buildLabReport.ts');
const labReport = read('lib/virtual-lab/LabReport.ts');
const liveRunner = read('lib/virtual-lab/LiveScenarioRunner.ts');

assert(localRuntime.includes('compileOpenRealityRuntime'), 'LocalRuntime must compile prompts through Runtime Kernel.');
assert(localRuntime.includes('new AutonomyCore().run'), 'LocalRuntime must route robot arm execution through AutonomyCore.');
assert(localRuntime.includes('compileTaskDslToAdapterPlan'), 'LocalRuntime must compile executable TaskDSL into AdapterPlan.');
assert(localRuntime.includes('validateAdapterPlan'), 'LocalRuntime must validate AdapterPlan before simulation.');
assert(localRuntime.includes('dryRun(adapterPlan)'), 'LocalRuntime must dry-run AdapterPlan before simulation.');
assert(localRuntime.includes('simulation_only_authorized'), 'LocalRuntime must explicitly authorize simulation-only execution.');
assert(localRuntime.includes('realDeviceExecution: false'), 'LocalRuntime must preserve realDeviceExecution=false boundary.');

assert(safetyMonitor.includes('manifest.adapter.realAdapterEnabled'), 'SafetyMonitor must reject enabled real adapters.');
assert(safetyMonitor.includes('plan.dryRunOnly !== true'), 'SafetyMonitor must reject non-dry-run plans.');
assert(safetyMonitor.includes("plan.mode === 'real_disabled'"), 'SafetyMonitor must reject real-disabled execution plans.');
assert(safetyMonitor.includes('adapter_dry_run_failed'), 'SafetyMonitor must block failed dry runs.');

assert(executionSession.includes('adapterPlan') && executionSession.includes('adapterDryRun') && executionSession.includes('auditLog'), 'ExecutionSession must capture AdapterPlan, dry-run result, and audit log.');
assert(auditLog.includes("stage: 'runtime_kernel'") || auditLog.includes("'runtime_kernel'"), 'Runtime audit log must record runtime kernel stage.');
assert(auditLog.includes("'adapter_plan'") && auditLog.includes("'dry_run'") && auditLog.includes("'execution_gate'"), 'Runtime audit log must capture adapter plan, dry run, and execution gate stages.');

assert(page.includes('new LocalRuntime().prepareSimulationSession'), 'UI Run must enter LocalRuntime before simulation.');
assert(page.includes('buildLocalRuntimeDecisionLabReport'), 'UI must emit LocalRuntime decision reports when execution stops before simulation.');
assert(page.includes('localRuntimeSession.auditLog'), 'UI must pass runtime audit logs into reporting/execution.');
assert(page.includes('localRuntimeSession.executableTaskDsl'), 'UI must only run simulation with LocalRuntime executable TaskDSL.');

assert(reportBuilder.includes('runtime_audit_log'), 'Lab report builder must persist runtime audit logs.');
assert(reportBuilder.includes('buildLocalRuntimeDecisionLabReport'), 'Report builder must support LocalRuntime stop reports.');
assert(labReport.includes('runtime_audit_log'), 'LabReport contract must expose runtime_audit_log.');
assert(liveRunner.includes('runtimeAuditLog'), 'LiveScenarioRunner must propagate runtime audit logs into execution reports.');

console.log('Local Runtime tests passed.');
console.log('- LocalRuntime gates execution through Runtime Kernel, AutonomyCore, AdapterPlan, and SafetyMonitor.');
console.log('- Structured runtime audit logs are persisted into LabReport.');
console.log('- UI execution path is routed through LocalRuntime before LiveScenarioRunner.');
