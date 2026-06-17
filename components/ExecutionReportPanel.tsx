import type { ExecutionReport } from '@/types/execution';
import { AccordionPanel } from './AccordionPanel';
import { StatusPill } from './StatusPill';

export function ExecutionReportPanel({ report, onReplay }: { report: ExecutionReport | null; onReplay: () => void }) {
  return (
    <AccordionPanel
      title="Execution Report"
      defaultOpen={false}
      forceOpen={report ? true : undefined}
      summary={report ? <span>{report.status} · {report.steps.length} steps · responsibility log</span> : <span>No run yet</span>}
    >
      {report ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs text-text-muted">{report.execution_id}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReplay}
                className="rounded-md border border-panel-border bg-panel px-3 py-1 text-xs font-semibold text-text-main hover:bg-gray-50"
              >
                Replay
              </button>
              <StatusPill status={report.status} />
            </div>
          </div>
          <div className="mb-4 rounded-lg border border-panel-border bg-background p-3 text-xs text-text-muted">
            <div className="font-semibold text-text-main">Simulator Dry Run</div>
            <div className="mt-1">Status: {report.dry_run.dry_run_status}</div>
            <div>Profile: {report.dry_run.checked_profile}</div>
            <div>Workspace: {String(report.dry_run.checked_workspace)} · Forbidden Zones: {String(report.dry_run.checked_forbidden_zones)} · Path: {String(report.dry_run.checked_path)}</div>
          </div>
          {report.dry_run_report && (
            <div className="mb-4 rounded-lg border border-panel-border bg-background p-3 text-xs text-text-muted">
              <div className="font-semibold text-text-main">Operational Dry Run Report</div>
              <div className="mt-1">Status: {report.dry_run_report.dry_run_status}</div>
              <div>Reachability: {String(report.dry_run_report.reachability_pass)} · Collision: {String(report.dry_run_report.collision_pass)}</div>
              <div>Forbidden Zones: {String(report.dry_run_report.forbidden_zone_pass)} · Steps: {report.dry_run_report.motion_steps_checked}</div>
              {report.dry_run_report.blocked_reasons.length > 0 && (
                <div className="mt-1 text-blocked-red">{report.dry_run_report.blocked_reasons.join(' ')}</div>
              )}
            </div>
          )}
          {report.motion_plan && (
            <div className="mb-4 rounded-lg border border-panel-border bg-background p-3 text-xs text-text-muted">
              <div className="font-semibold text-text-main">Motion Plan</div>
              <div className="mt-1">{report.motion_plan.steps.length} planned steps · {report.adapter_commands?.length ?? 0} adapter commands</div>
            </div>
          )}
          {report.adapter_commands && (
            <div className="mb-4 rounded-lg border border-panel-border bg-background p-3 text-xs text-text-muted">
              <div className="font-semibold text-text-main">Device Commands</div>
              <div className="custom-scrollbar mt-2 max-h-32 overflow-auto font-mono text-[11px]">
                {report.adapter_commands.map((command) => (
                  <div key={`${command.source_step_id}-${command.command}`}>{command.source_step_id}: {command.command}</div>
                ))}
              </div>
            </div>
          )}
          <div className="border-l border-panel-border pl-4">
            {report.steps.map((step) => (
              <div key={step.step_id} className="relative mb-4 last:mb-0">
                <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full border border-panel-border bg-panel" />
                <div className="text-xs font-semibold">{step.action}</div>
                <div className="mt-1 text-xs text-text-muted">{step.target ?? 'no target'} · {step.status}</div>
                {step.reason && <div className="mt-1 text-xs text-blocked-red">{step.reason}</div>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted">{report.summary}</p>
          {report.timeline && (
            <div className="mt-4 rounded-lg border border-panel-border bg-background p-3 text-xs text-text-muted">
              <div className="font-semibold text-text-main">Replay Timeline</div>
              {report.timeline.map((event) => (
                <div key={event.id} className="mt-1">{event.timestamp_ms}ms · {event.message}</div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-text-muted">Execution or block events will open this panel automatically.</p>
      )}
    </AccordionPanel>
  );
}
