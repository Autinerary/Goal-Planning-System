/**
 * Pronouns a person can choose on Your profile and in setup (Riipen Labs,
 * Group 34, slides 21 and 25). Saved as one line, such as
 * "she/her, they/them", in profiles.pronouns (STEP 64), which holds up to 60
 * characters. Other members see them next to the person's name.
 */

export const PRONOUN_OPTIONS = ['she/her', 'he/him', 'they/them', 'ze/zir', 'xe/xem', 've/ver', 'ey/em'] as const

export const PRONOUNS_MAX = 60

const known = (p: string) => (PRONOUN_OPTIONS as readonly string[]).includes(p.toLowerCase())

/** The saved line, split into the listed choices and anything typed. */
export function splitPronouns(value: string | null | undefined): { picked: string[]; own: string } {
  const parts = (value || '').split(',').map((p) => p.trim()).filter(Boolean)
  return {
    picked: parts.filter(known).map((p) => p.toLowerCase()),
    own: parts.filter((p) => !known(p)).join(', '),
  }
}

/** The line to save: listed choices in the list's order, then anything typed. */
export function joinPronouns(picked: string[], own: string): string {
  const ordered = PRONOUN_OPTIONS.filter((p) => picked.includes(p))
  return [...ordered, own.trim()].filter(Boolean).join(', ').slice(0, PRONOUNS_MAX)
}
