import type { SafetyReport } from '@/types/safety';
import type { DryRunReport } from '@/types/execution';
import type { OperationalDryRunReport } from '@/types/simulation';
import { StatusPill } from './StatusPill';

export function SafetyRuntimePanel({
  report,
  currentProfile,
  riskClass,
  dryRun,
  operationalDryRun
}: {
  report: SafetyReport | null;
  currentProfile: string;
  riskClass: string;
  dryRun: DryRunReport | null;
  operationalDryRun: OperationalDryRunReport | null;
}) {
  const status = report?.status ?? 'idle';

  return (
    <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold">Safety Runtime</h2>
          <p className="mt-1 text-xs text-text-muted">Always-on policy gate before device execution.</p>
        </div>
        <StatusPill status={status === 'pass' ? 'pass' : status === 'blocked' ? 'blocked' : status === 'needs_confirmation' ? 'needs_confirmation' : 'idle'} />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Score</div>
          <div className="mt-1 text-2xl font-bold">{report?.score ?? 0}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Dry Run</div>
          <div className="mt-1 text-sm font-semibold uppercase">{dryRun?.dry_run_status ?? 'idle'}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Current Profile</div>
          <div className="mt-1 text-sm font-semibold">{currentProfile}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Risk Class</div>
          <div className="mt-1 text-sm font-semibold uppercase">{riskClass}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Reachability</div>
          <div className="mt-1 text-sm font-semibold uppercase">{operationalDryRun ? (operationalDryRun.reachability_pass ? 'PASS' : 'FAIL') : 'idle'}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Collision</div>
          <div className="mt-1 text-sm font-semibold uppercase">{operationalDryRun ? (operationalDryRun.collision_pass ? 'PASS' : 'FAIL') : 'idle'}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Forbidden Zones</div>
          <div className="mt-1 text-sm font-semibold uppercase">{operationalDryRun ? (operationalDryRun.forbidden_zone_pass ? 'PASS' : 'FAIL') : 'idle'}</div>
        </div>
        <div className="rounded-lg border border-panel-border bg-background p-3">
          <div className="text-xs text-text-muted">Motion Plan Steps</div>
          <div className="mt-1 text-sm font-semibold">{operationalDryRun?.motion_steps_checked ?? 0}</div>
        </div>
      </div>
      <div className="space-y-2">
        {(report?.checks ?? []).map((check) => (
          <div key={check.id} className="flex items-start justify-between gap-3 rounded-lg border border-panel-border bg-background px-3 py-2">
            <div>
              <div className="text-xs font-medium">{check.label}</div>
              {check.reason && <div className="mt-1 text-xs text-blocked-red">{check.reason}</div>}
            </div>
            <span className={check.status === 'pass' ? 'text-xs font-bold text-pass-green' : 'text-xs font-bold text-blocked-red'}>
              {check.status.toUpperCase()}
            </span>
          </div>
        ))}
        {!report && <div className="rounded-lg border border-panel-border bg-background px-3 py-3 text-xs text-text-muted">Compile a task to run policy checks.</div>}
      </div>
      {report?.status === 'blocked' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-blocked-red">
          BLOCKED: {report.blocked_reasons.join(' ')}
        </div>
      )}
    </section>
  );
}
