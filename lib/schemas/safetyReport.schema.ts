import { z } from 'zod';

export const SafetyCheckSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: z.enum(['pass', 'fail', 'warning']),
  reason: z.string().optional()
});

export const SafetyReportSchema = z.object({
  status: z.enum(['pass', 'blocked', 'needs_confirmation']),
  score: z.number().min(0).max(100),
  checks: z.array(SafetyCheckSchema),
  blocked_reasons: z.array(z.string()),
  summary: z.string()
});
