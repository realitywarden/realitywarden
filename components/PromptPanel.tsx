import { ValidationControls } from './ValidationControls';
import { SampleTaskGrid } from './SampleTaskGrid';

interface PromptPanelProps {
  prompt: string;
  selectedProfileId: string;
  profiles: { id: string; label: string }[];
  onPromptChange: (prompt: string) => void;
  onProfileChange: (profileId: string) => void;
  onCompile: () => void;
  onExport: () => void;
  onValidateAll: () => void;
  validationRunning: boolean;
}

export function PromptPanel({
  prompt,
  selectedProfileId,
  profiles,
  onPromptChange,
  onProfileChange,
  onCompile,
  onExport,
  onValidateAll,
  validationRunning
}: PromptPanelProps) {
  return (
    <aside className="flex h-full w-[30%] flex-col gap-4">
      <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-console-blue">Open Reality Interface</p>
          <h1 className="mt-2 text-2xl font-bold leading-tight">Open Reality Workspace</h1>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            AI needs a USB for the physical world. We build the open one.
          </p>
        </div>
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          placeholder="输入自然语言任务..."
          className="h-32 w-full resize-none rounded-lg border border-panel-border bg-background p-4 text-text-main outline-none transition-all duration-200 placeholder:text-text-muted focus:border-console-blue focus:ring-1 focus:ring-console-blue"
        />
        <div className="mt-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">Device Profile</label>
          <select
            value={selectedProfileId}
            onChange={(event) => onProfileChange(event.target.value)}
            className="w-full rounded-lg border border-panel-border bg-background px-3 py-2 text-sm text-text-main outline-none transition-all focus:border-console-blue focus:ring-1 focus:ring-console-blue"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={onCompile}
          className="mt-4 flex w-full items-center justify-center rounded-lg bg-console-blue py-3 font-medium text-white transition-colors hover:bg-[#0052A3] active:bg-[#004680]"
        >
          Compile Task
        </button>
      </section>
      <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
        <div className="mb-3 text-sm font-bold">Sample Tasks</div>
        <SampleTaskGrid onSelect={onPromptChange} />
      </section>
      <section className="rounded-xl border border-panel-border bg-panel p-5 shadow-sm">
        <div className="grid gap-3">
          <ValidationControls onRunValidation={onValidateAll} isRunning={validationRunning} />
          <button
            type="button"
            onClick={onExport}
            className="w-full rounded-lg border border-panel-border bg-panel py-2 font-medium text-text-main transition-colors hover:bg-gray-50"
          >
            Export JSON
          </button>
        </div>
      </section>
    </aside>
  );
}
