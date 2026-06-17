export interface SafetyReport {
  status: 'pass' | 'blocked' | 'needs_confirmation';
  score: number;
  checks: SafetyCheck[];
  blocked_reasons: string[];
  summary: string;
}

export interface SafetyCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning';
  reason?: string;
}
