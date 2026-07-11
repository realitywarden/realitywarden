/**
 * GATE-PRIVATE actuation ticket (audit 1.1).
 *
 * This module is intentionally NOT exported from `lib/hardware/index.ts`.
 * The sanctioned importers are the execution gate and the adapter/transport
 * boundary that verifies the ticket (plus invariant tests for this contract).
 * An ESLint no-restricted-imports rule enforces the boundary everywhere else.
 *
 * Why a ticket: invariant 1 ("blocked => zero frames on the wire") must be
 * structural, not conventional. With the ticket, code that merely holds an
 * adapter or transport reference CANNOT emit an actuation frame:
 *   - SerialEsp32Transport.send() refuses actuation commands outright
 *     (actuation_requires_gate), before anything reaches the wire.
 *   - sendActuation() requires this exact symbol; there is no other value
 *     that satisfies the check.
 * Read-only commands (read_distance, diagnose_*) stay on plain send(), so
 * diagnostics never need — and never get — actuation rights.
 */
export const ACTUATION_TICKET: unique symbol = Symbol('realitywarden.actuation-ticket');

export type ActuationTicket = typeof ACTUATION_TICKET;

/**
 * Frame-level actuation command registry. Transport-level enforcement cannot
 * consult capability declarations (transports are device-agnostic), so every
 * actuation command MUST be listed here. Forgetting to list a new actuation
 * command fails SAFE only at the adapter/capability layer; therefore adding an
 * actuation capability requires adding it here first (see audit 5.2 note).
 */
const ACTUATION_COMMANDS: ReadonlySet<string> = new Set(['move_to_angle']);

export function isActuationCommand(cmd: string): boolean {
  return ACTUATION_COMMANDS.has(cmd);
}
