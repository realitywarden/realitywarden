export function ValidationControls({ onRunValidation, isRunning }: { onRunValidation: () => void; isRunning: boolean }) {
  return (
    <button
      type="button"
      onClick={onRunValidation}
      disabled={isRunning}
      className="w-full rounded-lg border border-panel-border bg-panel py-2 font-medium text-text-main transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRunning ? 'Fleet Check Running' : 'Fleet Check'}
    </button>
  );
}
