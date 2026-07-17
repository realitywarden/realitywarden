/**
 * Deterministic natural-language parser for the REAL HARDWARE panel command
 * box (Promote-to-Real, 2026-07-17).
 *
 * HONESTY CONTRACT:
 * - This is a RULE parser, not an LLM. It extracts only EXPLICIT angle
 *   tokens ("45°", "45度", "45 degrees") and explicit zero keywords
 *   ("归零", "back to zero"). Anything it cannot fully account for is
 *   rejected with a reason — it never guesses an intent.
 * - It performs NO range validation and NO clamping. The parsed sequence is
 *   an UNTRUSTED PROPOSAL like any other: the authoritative Action Manifest
 *   validator and the hardware safety gate reject out-of-range or unsafe
 *   values downstream (invariant 5: reject, never clamp).
 * - A digit left over after extraction (e.g. "wait 5 seconds then 45°")
 *   means the text contains a number this parser does not understand; the
 *   whole command is rejected instead of partially executed.
 */

export type RealCommandRejectReason =
  | 'empty_command'
  | 'no_explicit_angle'
  | 'ambiguous_number'
  | 'too_many_steps';

export type RealCommandParseResult =
  | { ok: true; angles: number[] }
  | { ok: false; reason: RealCommandRejectReason; detail: string };

/** Sequence-length ceiling shared with HardwareActionSequenceRunner. */
export const REAL_COMMAND_MAX_STEPS = 16;

const ANGLE_TOKEN =
  /(-?\d+(?:\.\d+)?)\s*(?:°|度|deg(?:ree)?s?\b)|归零|回零|回到零|back to (?:zero|0)\b|return to (?:zero|0)\b/gi;

const ZERO_KEYWORD = /^(?:归零|回零|回到零|back to (?:zero|0)|return to (?:zero|0))$/i;

export function parseRealNaturalCommand(text: string): RealCommandParseResult {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty_command', detail: 'command text is empty' };
  }

  const angles: number[] = [];
  let leftover = '';
  let lastIndex = 0;
  ANGLE_TOKEN.lastIndex = 0;
  for (let match = ANGLE_TOKEN.exec(trimmed); match !== null; match = ANGLE_TOKEN.exec(trimmed)) {
    leftover += trimmed.slice(lastIndex, match.index);
    lastIndex = match.index + match[0].length;
    if (typeof match[1] === 'string') {
      angles.push(Number(match[1]));
    } else if (ZERO_KEYWORD.test(match[0])) {
      angles.push(0);
    }
  }
  leftover += trimmed.slice(lastIndex);

  if (angles.length === 0) {
    return {
      ok: false,
      reason: 'no_explicit_angle',
      detail: 'no explicit angle token (e.g. "45°", "45度", "45 degrees", "归零") was found'
    };
  }
  if (/\d/.test(leftover)) {
    return {
      ok: false,
      reason: 'ambiguous_number',
      detail: 'the text contains a number that is not an explicit angle; rejected instead of guessing'
    };
  }
  if (angles.length > REAL_COMMAND_MAX_STEPS) {
    return {
      ok: false,
      reason: 'too_many_steps',
      detail: `parsed ${angles.length} steps; the governed sequence limit is ${REAL_COMMAND_MAX_STEPS}`
    };
  }
  return { ok: true, angles };
}
