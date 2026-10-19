/**
 * Personality, optional (the team's note, October 2026: "Make this one
 * optional/skippable … If selected, should adjust based on personality type
 * intersections with norms").
 *
 * The Big Five, measured with the Mini-IPIP: 20 items from the International
 * Personality Item Pool (Donnellan, Oswald, Baird & Lucas, 2006). The IPIP
 * says: "The items and scales are in the public domain … one can copy, edit,
 * translate, or use them for any purpose without asking permission and
 * without paying a fee" (ipip.ori.org). Four-letter types (INTJ…) are kept
 * only as a label someone may add about themselves: the research on
 * personality and norms uses the Big Five.
 *
 * Plain data, no imports, safe on both sides (lib/personality.test.mjs).
 */

export type Trait = 'extraversion' | 'agreeableness' | 'conscientiousness' | 'neuroticism' | 'openness'

/** Each trait in everyday words, both ends described as ways of being, neither as a fault. */
export const TRAITS: { id: Trait; label: string; low: string; high: string }[] = [
  { id: 'extraversion', label: 'Where your energy comes from', low: 'Recharges with quiet and time alone', high: 'Recharges with people and activity' },
  { id: 'agreeableness', label: 'How you tune in to others', low: 'Direct, and focused on the task', high: 'Tuned in to how others feel' },
  { id: 'conscientiousness', label: 'How you like to organize', low: 'Flexible, goes with the flow', high: 'Likes order and finishing things' },
  { id: 'neuroticism', label: 'How strongly feelings hit', low: 'Steady most of the time', high: 'Feels things strongly, and stress hits hard' },
  { id: 'openness', label: 'How you like ideas', low: 'Prefers the concrete and familiar', high: 'Loves imagination and new ideas' },
]

/** The Mini-IPIP's 20 items, as worded by the IPIP; keyed -1 are scored the other way. */
export const ITEMS: { id: string; text: string; trait: Trait; keyed: 1 | -1 }[] = [
  { id: 'e1', text: 'Am the life of the party.', trait: 'extraversion', keyed: 1 },
  { id: 'a1', text: 'Sympathize with others’ feelings.', trait: 'agreeableness', keyed: 1 },
  { id: 'c1', text: 'Get chores done right away.', trait: 'conscientiousness', keyed: 1 },
  { id: 'n1', text: 'Have frequent mood swings.', trait: 'neuroticism', keyed: 1 },
  { id: 'o1', text: 'Have a vivid imagination.', trait: 'openness', keyed: 1 },
  { id: 'e2', text: 'Don’t talk a lot.', trait: 'extraversion', keyed: -1 },
  { id: 'a2', text: 'Am not interested in other people’s problems.', trait: 'agreeableness', keyed: -1 },
  { id: 'c2', text: 'Often forget to put things back in their proper place.', trait: 'conscientiousness', keyed: -1 },
  { id: 'n2', text: 'Am relaxed most of the time.', trait: 'neuroticism', keyed: -1 },
  { id: 'o2', text: 'Am not interested in abstract ideas.', trait: 'openness', keyed: -1 },
  { id: 'e3', text: 'Talk to a lot of different people at parties.', trait: 'extraversion', keyed: 1 },
  { id: 'a3', text: 'Feel others’ emotions.', trait: 'agreeableness', keyed: 1 },
  { id: 'c3', text: 'Like order.', trait: 'conscientiousness', keyed: 1 },
  { id: 'n3', text: 'Get upset easily.', trait: 'neuroticism', keyed: 1 },
  { id: 'o3', text: 'Have difficulty understanding abstract ideas.', trait: 'openness', keyed: -1 },
  { id: 'e4', text: 'Keep in the background.', trait: 'extraversion', keyed: -1 },
  { id: 'a4', text: 'Am not really interested in others.', trait: 'agreeableness', keyed: -1 },
  { id: 'c4', text: 'Make a mess of things.', trait: 'conscientiousness', keyed: -1 },
  { id: 'n4', text: 'Seldom feel blue.', trait: 'neuroticism', keyed: -1 },
  { id: 'o4', text: 'Do not have a good imagination.', trait: 'openness', keyed: -1 },
]

/** How well each describes you, 1 to 5 (the IPIP's wording). */
export const SCALE = ['Very inaccurate', 'Moderately inaccurate', 'Neither accurate nor inaccurate', 'Moderately accurate', 'Very accurate'] as const

export type Band = 'low' | 'middle' | 'high'
export type Profile = Partial<Record<Trait, Band>>

/**
 * Each trait's average, 1 to 5, from the answers (item id → 1..5). A trait
 * needs at least three of its four items answered; otherwise it is left out,
 * never guessed.
 */
export function scoreTraits(answers: Record<string, number>): Partial<Record<Trait, number>> {
  const out: Partial<Record<Trait, number>> = {}
  for (const t of TRAITS) {
    const got = ITEMS.filter((i) => i.trait === t.id && Number.isInteger(answers[i.id]) && answers[i.id] >= 1 && answers[i.id] <= 5).map((i) =>
      i.keyed === 1 ? answers[i.id] : 6 - answers[i.id]
    )
    if (got.length >= 3) out[t.id] = Math.round((got.reduce((a, b) => a + b, 0) / got.length) * 100) / 100
  }
  return out
}

/** Below 2.5 is low, above 3.5 high: wide middle on purpose, a short form isn't precise. */
export const band = (score: number): Band => (score < 2.5 ? 'low' : score > 3.5 ? 'high' : 'middle')

export function profileOf(answers: Record<string, number>): Profile {
  const s = scoreTraits(answers)
  return Object.fromEntries(Object.entries(s).map(([t, v]) => [t, band(v as number)])) as Profile
}

/** A four-letter type someone may add about themselves (INTJ, ENFP-T…), kept as they typed it. */
export const isTypeLabel = (v: unknown): v is string => typeof v === 'string' && /^[EI][NS][TF][JP](-[AT])?$/i.test(v.trim())

/** What is kept with the person's preferences (app/profile/personality). */
export interface PersonalityChoice {
  answers?: Record<string, number>
  profile?: Profile
  /** A four-letter type they chose to add (INTJ, ENFP-T…), only as a label. */
  typeLabel?: string
  /** "Not for me": the card stops asking. */
  skipped?: boolean
  updatedAt?: string
}

/**
 * How plans are written for someone, from their own answers: plain guidance
 * the planner adds to its strategies (backend path_planning_agent,
 * supportContext.workingStyle). Where a trait meets a norm, a line says how
 * the two shape steps together. It never infers a personality from a norm:
 * only what the person said about themselves is used.
 */
export function workingStyleFor(profile: Profile | null | undefined, norms: string[] = []): string {
  if (!profile) return ''
  const n = norms.map((x) => x.toLowerCase())
  const has = (...words: string[]) => n.some((x) => words.some((w) => x.includes(w)))
  const lines: string[] = []
  if (profile.extraversion === 'low') lines.push('Recharges alone: put solo or one-to-one steps first, and leave quiet time after social ones.')
  if (profile.extraversion === 'high') lines.push('Gets energy from people: include steps done with others.')
  if (profile.conscientiousness === 'low') lines.push('Flexible about structure: keep steps short, one thing at a time, with reminders and a visible checklist.')
  if (profile.conscientiousness === 'high') lines.push('Likes order: give steps in a clear sequence with dates.')
  if (profile.neuroticism === 'high') lines.push('Stress hits hard: start small, pace gently, and add a plan for harder days.')
  if (profile.openness === 'high') lines.push('Enjoys new ideas: offer some variety and creative options.')
  if (profile.openness === 'low') lines.push('Prefers the familiar: build on routines they already have, and explain changes ahead of time.')
  if (profile.agreeableness === 'high') lines.push('Motivated by others: include steps that help or include someone they care about.')
  if (profile.agreeableness === 'low') lines.push('Task-focused: keep steps direct and practical.')
  // Where a trait and a norm meet.
  if (profile.extraversion === 'low' && has('autism', 'autistic', 'asd')) lines.push('With autism and a quieter style: make social steps small and predictable, with a script or an online option first.')
  if (profile.conscientiousness === 'low' && has('adhd', 'attention')) lines.push('With ADHD and a flexible style: add outside structure, such as timers, body doubling and 15-minute pieces.')
  if (profile.neuroticism === 'high' && has('anxiety', 'ocd', 'panic')) lines.push('With anxiety and strong feelings: build up exposure in small, chosen steps, with recovery planned in.')
  return lines.join(' ').slice(0, 1000)
}
