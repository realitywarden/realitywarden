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

for (const status of ['not_runnable', 'unsupported', 'ambiguous', 'ask_human', 'blocked']) {
  assert(page.includes(`runtimeKernelResult.status === '${status}'`), `UI must branch on runtime status ${status}.`);
}

assert(page.includes('setLabReport(buildRuntimeDecisionLabReport({'), 'UI must generate lab reports for runtime decisions that do not execute.');
assert(page.includes('setLabReport(buildAutonomyStopLabReport({'), 'UI must generate lab reports when AutonomyCore stops execution.');
assert(liveRunner.includes('buildExecutionLabReport({'), 'LiveScenarioRunner must emit enriched execution reports.');
assert(scenarioRunner.includes('buildExecutionLabReport({'), 'ScenarioRunner must emit enriched execution reports.');

console.log('Reporting audit tests passed.');
console.log('- Non-executed runtime decisions are wired to lab report generation.');
console.log('- Executed runs use the enriched execution lab report builder.');
