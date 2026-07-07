/**
 * STATUS colors for three.js materials and canvas drawing, mirroring the CSS
 * variables in app/globals.css (the single source of truth for the UI layer).
 * Rule: red = blocked, green = executed/safe, orange = running, yellow =
 * warning. Use these ONLY for status semantics, never for object bodies.
 */
export const STATUS_COLORS = {
  blocked: '#E11D48',
  executed: '#10B981',
  running: '#F59E0B',
  warning: '#FACC15',
  info: '#0284C7'
} as const;
