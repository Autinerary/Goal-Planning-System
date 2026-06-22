/**
 * Tidbits — Solved-line validators.
 *
 * The spec requires a key insight + a TLDR of 1-3 sentences whenever a
 * post is marked solved. We enforce this both in the API and in the
 * DB CHECK constraint. Keep the limits in sync with the SQL schema:
 *   solved_tldr        TEXT CHECK (length(solved_tldr) <= 600)
 *   solved_key_insight TEXT CHECK (length(solved_key_insight) <= 280)
 */

export const KEY_INSIGHT_MIN = 8;
export const KEY_INSIGHT_MAX = 280;
export const TLDR_MIN = 12;
export const TLDR_MAX = 600;

/**
 * Sentence count = number of terminal punctuation marks (. ! ? …), with a
 * fallback of 1 for non-empty input. Good enough for "is this 1-3 sentences".
 */
function sentenceCount(input: string): number {
  const matches = input.match(/[.!?…](\s|$)/g);
  return matches ? matches.length : input.trim() ? 1 : 0;
}

/**
 * Returns null if valid, else a user-facing error string.
 */
export function validateSolvedPayload(
  key_insight: string,
  tldr: string
): string | null {
  const ki = (key_insight ?? '').trim();
  const td = (tldr ?? '').trim();

  if (!ki) return 'Key insight is required';
  if (ki.length < KEY_INSIGHT_MIN) {
    return `Key insight must be at least ${KEY_INSIGHT_MIN} characters`;
  }
  if (ki.length > KEY_INSIGHT_MAX) {
    return `Key insight must be at most ${KEY_INSIGHT_MAX} characters`;
  }

  if (!td) return 'TLDR is required';
  if (td.length < TLDR_MIN) {
    return `TLDR must be at least ${TLDR_MIN} characters`;
  }
  if (td.length > TLDR_MAX) {
    return `TLDR must be at most ${TLDR_MAX} characters`;
  }

  const sentences = sentenceCount(td);
  if (sentences < 1 || sentences > 3) {
    return 'TLDR must be 1-3 sentences';
  }
  return null;
}
