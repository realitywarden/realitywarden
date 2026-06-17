'use client';

import { useState } from 'react';

export function JsonPanel({ value, clipped = false }: { value: unknown; clipped?: boolean }) {
  const [full, setFull] = useState(false);
  const json = JSON.stringify(value ?? {}, null, 2);

  return (
    <div className="relative">
      <pre
        className={`custom-scrollbar overflow-x-auto rounded-lg bg-code-dark p-4 font-mono text-xs leading-relaxed text-code-light ${
          clipped && !full ? 'max-h-[300px] overflow-hidden' : 'max-h-[620px] overflow-auto'
        }`}
      >
        {json}
      </pre>
      {clipped && !full && (
        <div className="absolute bottom-0 left-0 flex h-24 w-full items-end justify-center rounded-b-lg bg-gradient-to-t from-code-dark to-transparent pb-2">
          <button
            type="button"
            onClick={() => setFull(true)}
            className="rounded-md border border-gray-600 bg-code-dark px-3 py-1 text-xs font-medium text-code-light"
          >
            View Full JSON
          </button>
        </div>
      )}
    </div>
  );
}
