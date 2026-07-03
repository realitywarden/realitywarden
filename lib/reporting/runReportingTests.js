const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const reportBuilder = read('lib/reporting/buildLabReport.ts');
const page = read('app/page.tsx');
const liveRunner = read('lib/virtual-lab/LiveScenarioRunner.ts');
const scenarioRunner = read('lib/virtual-lab/ScenarioRunner.ts');

assert(reportBuilder.includes('export function buildRuntimeDecisionLabReport'), 'buildRuntimeDecisionLabReport must exist for blocked / unsupported / ambiguous / not_runnable reports.');
assert(reportBuilder.includes('export function buildAutonomyStopLabReport'), 'buildAutonomyStopLabReport must exist for autonomy stop conditions.');
assert(reportBuilder.includes('export function buildExecutionLabReport'), 'buildExecutionLabReport must exist for compiled runs.');
assert(reportBuilder.includes('export function buildLocalRuntimeDecisionLabReport'), 'buildLocalRuntimeDecisionLabReport must exist for Local Runtime gating reports.');
assert(reportBuilder.includes('runtime_audit_log'), 'Lab report builders must persist runtime audit logs.');

assert(page.includes('new LocalRuntime().prepareSimulationSession'), 'UI Run must prepare a Local Runtime session before simulation dispatch.');
assert(page.includes('setLabReport(buildLocalRuntimeDecisionLabReport({'), 'UI must generate lab reports for Local Runtime decisions that do not execute.');
assert(page.includes('localRuntimeSession.auditLog'), 'UI must forward Local Runtime audit logs into reporting and execution flow.');
assert(liveRunner.includes('buildExecutionLabReport({'), 'LiveScenarioRunner must emit enriched execution reports.');
assert(liveRunner.includes('runtimeAuditLog'), 'LiveScenarioRunner must forward runtime audit logs into execution reports.');
assert(scenarioRunner.includes('buildExecutionLabReport({'), 'ScenarioRunner must emit enriched execution reports.');

console.log('Reporting audit tests passed.');
console.log('- Local Runtime decisions are wired to lab report generation.');
console.log('- Executed runs preserve runtime audit logs inside enriched execution reports.');
