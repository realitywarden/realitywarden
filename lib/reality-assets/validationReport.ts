import type { RealityAssetValidationResult } from './types';

export interface RealityAssetValidationReport {
  valid: boolean;
  severity: 'pass' | 'warning' | 'error' | 'unsafe';
  summary: string;
  errors: string[];
  warnings: string[];
  fixHints: string[];
}

function hintFor(message: string): string {
  if (message.includes('realAdapterEnabled')) return 'realAdapterEnabled must be false in Public Alpha.';
  if (message.includes('deviceManifest')) return 'Add a complete deviceManifest section.';
  if (message.includes('capabilityContracts')) return 'Add capabilityContracts and keep them aligned with deviceManifest.capabilities.';
  if (message.includes('Coming Soon')) return 'Coming Soon assets cannot expose runnable adapters.';
  if (message.includes('safetyNotes')) return 'Add safetyNotes describing the simulation-only boundary.';
  if (message.includes('examplePrompts')) return 'Add supported, unsupported, unsafe, or ambiguous examplePrompts.';
  return 'Fix the Reality Asset package field named in this validation message.';
}

export function buildRealityAssetValidationReport(result: RealityAssetValidationResult): RealityAssetValidationReport {
  const unsafe = result.errors.some((error) => error.includes('realAdapterEnabled'));
  const severity = result.valid
    ? result.warnings.length > 0 ? 'warning' : 'pass'
    : unsafe ? 'unsafe' : 'error';
  const fixHints = Array.from(new Set(result.errors.map(hintFor)));

  if (!result.valid || result.warnings.length > 0) {
    fixHints.push('No real execution is available from Reality Asset packages in the current Public Alpha.');
  }

  return {
    valid: result.valid,
    severity,
    summary: result.valid
      ? 'Reality Asset package is valid for local catalog validation. Real device execution remains disabled.'
      : unsafe
        ? 'Reality Asset package is unsafe and cannot be imported.'
        : 'Reality Asset package failed validation.',
    errors: result.errors,
    warnings: result.warnings,
    fixHints
  };
}
