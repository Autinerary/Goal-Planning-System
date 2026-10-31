// One name for each condition. ResourceHub stores a person's barriers two ways: structured (category 'neurodivergence',
// type 'autism') and as the onboarding label the main app writes (category 'general', type 'Autism spectrum disorder').
// On 30 October 2026 the same condition was in the table under four or five spellings, so a pattern search that counted
// whole barrier sets found nothing. Everything here is lower-case words, so it can be tested without the app.

const ALIASES: Array<[RegExp, string]> = [
  [/^(autism|asd|autism spectrum( disorder)?)$/, 'autism'],
  [/^(adhd|attention.*)$/, 'adhd'],
  [/^(ocd|obsessive.*)$/, 'ocd'],
  [/^(anxiety|anxiety disorders?)$/, 'anxiety'],
  [/^(depression|mood disorders?)$/, 'depression'],
  [/^(dyslexia|dyscalculia|dysgraphia|learning disabilit.*)$/, 'learning difference'],
  [/^(hearing.*|deaf.*)$/, 'hearing'],
  [/^(vision.*|blind.*|low vision)$/, 'vision'],
  [/^(sensory|sensory processing.*)$/, 'sensory'],
  [/^(esl|language|english as .*)$/, 'language'],
  [/^(immigrant.*|refugee.*|newcomer.*)$/, 'newcomer'],
  [/^(low income|limited income|financial.*)$/, 'low income'],
  [/^(visible minority)$/, 'visible minority'],
  [/^(lgbtq\+?|lgbtq2s\+?|2slgbtq\+?)$/, 'lgbtq'],
  [/^(chronic illness|chronic.*|autoimmune.*)$/, 'chronic illness'],
  [/^(rural.*|remote.*)$/, 'rural'],
  [/^(transport.*)$/, 'transport'],
  [/^(first generation|first gen.*)$/, 'first generation'],
]

// Answers that say nothing about a condition.
const NONE = /^(prefer not to (share|say)|no current barriers?|none|n\/a|other|unknown)$/

/** The condition a stored barrier stands for, or null when it names none. */
export function conditionOf(category: string | null | undefined, type: string | null | undefined): string | null {
  const t = String(type ?? '').toLowerCase().replace(/[_\-/]+/g, ' ').replace(/[^a-z0-9+ ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!t || NONE.test(t)) return null
  for (const [pattern, name] of ALIASES) if (pattern.test(t)) return name
  return t
}

/** A person's distinct conditions, sorted, from their stored barriers. */
export function conditionsOf(barriers: Array<{ barrier_category?: string | null; barrier_type?: string | null }>): string[] {
  return [...new Set(barriers.map((b) => conditionOf(b.barrier_category, b.barrier_type)).filter((c): c is string => !!c))].sort()
}

/** Every pair and triple of conditions a person has, as sorted keys joined with '|'. */
export function combinationsOf(conditions: string[], maxSize = 3): string[] {
  const out: string[] = []
  const pick = (start: number, chosen: string[]) => {
    if (chosen.length >= 2) out.push(chosen.join('|'))
    if (chosen.length === maxSize) return
    for (let i = start; i < conditions.length; i++) pick(i + 1, [...chosen, conditions[i]])
  }
  pick(0, [])
  return out
}
