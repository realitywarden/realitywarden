import { samplePrompts } from '@/lib/samples/samplePrompts';

export function SampleTaskGrid({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="grid gap-3">
      {samplePrompts.map((sample) => (
        <button
          key={sample.id}
          type="button"
          onClick={() => onSelect(sample.prompt)}
          className="rounded-lg border border-panel-border bg-background p-3 text-left text-sm text-text-muted transition-all hover:border-gray-300 hover:bg-white"
        >
          <div className="mb-1 font-semibold text-text-main">{sample.title}</div>
          {sample.prompt}
        </button>
      ))}
    </div>
  );
}
