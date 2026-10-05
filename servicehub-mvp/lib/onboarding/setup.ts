/**
 * ResourceHub setup, in three steps: who you are, one topic and what you hope
 * to find, then a first place to start.
 *
 * Riipen Labs, Group 8 (September 2026) found the five-step setup (Welcome,
 * Location, Norms, Impact, Context) asked for location, diagnosis, identity
 * and health "before showing a single resource", repeated the impact slider,
 * and threw some answers away (life stage, goals and notes were never saved).
 * They recommended "Role -> one topic -> first personalized resource", with
 * everything else optional and asked later, in context. Location is now asked
 * where it is used (the home page, search and the profile), and identity,
 * health and other disabilities live on the profile page.
 *
 * Used by app/onboarding/page.tsx, the profile page, the prompts that ask for
 * more later, and the APIs that save the answers (app/api/onboarding/save,
 * app/api/me/profile, app/api/me/norms).
 */

import { NORM_GROUPS } from '@/lib/norms/taxonomy'

/** Sent with ResourceHub's events (app/api/events), to compare setups. */
export const SETUP_VERSION = 'rh-3step-2026-10'

export const SETUP_STEPS = ['role', 'topic', 'first'] as const
export type SetupStep = (typeof SETUP_STEPS)[number]

export interface SetupRole {
  /** Stored in profiles.role. */
  id: string
  label: string
  description: string
  /** Here for someone else, so matches are about the person they support. */
  forSomeoneElse: boolean
}

export const SETUP_ROLES: SetupRole[] = [
  { id: 'self_advocate', label: 'Self-advocate', description: 'For yourself, from your own experience.', forSomeoneElse: false },
  { id: 'parent', label: 'Parent or family', description: 'For your child or someone in your family.', forSomeoneElse: true },
  { id: 'caregiver', label: 'Caregiver', description: 'For someone you support, at home or as your job.', forSomeoneElse: true },
  { id: 'professional', label: 'Professional', description: 'For the people you work with, as a therapist, educator or researcher.', forSomeoneElse: true },
]

export const findRole = (id: string | null | undefined) => SETUP_ROLES.find((r) => r.id === id)

export interface NormChoice {
  id: string
  label: string
  /** NORM_GROUPS key, stored as user_barriers.barrier_category. */
  group: string
  groupLabel: string
}

/** Every norm, from the shared taxonomy (lib/norms/taxonomy.ts). */
export const ALL_NORMS: NormChoice[] = NORM_GROUPS.flatMap((g) =>
  g.norms.map((n) => ({ id: n.id, label: n.label, group: g.key, groupLabel: g.label }))
)

export const findNorm = (id: string | null | undefined) => ALL_NORMS.find((n) => n.id === id)

/** Step 2's first choices: the Neurodivergence norms. Any other norm can be
 *  found with the search beside them. */
export const TOPIC_CHOICES = ALL_NORMS.filter((n) => n.group === 'neurodivergence')

/** "Other (specify)" norms take a few words in their notes. */
export const isOtherNorm = (id: string) => id.endsWith('_other')

/**
 * The profile's "More about you", asked only there and never in setup:
 * Group 8 recommended "deferring location, identity, and health fields to
 * optional, self-initiated moments after the user's first session".
 */
export const MORE_ABOUT_YOU: { group: string; title: string; hint: string }[] = [
  { group: 'identity', title: 'Identity & background', hint: 'Helps us show places rated by people who share your experience.' },
  { group: 'health', title: 'Health', hint: 'Private, and never needed to use ResourceHub.' },
  { group: 'disability', title: 'Other disabilities', hint: "Disabilities you'd like reflected in your matches." },
]

/** Answers that mean "nothing to match on", from older setups. */
export const NOT_A_NORM = /^(prefer not to (share|say)|no current (barriers|norms))$/i

/** Norms a search for these words should offer, e.g. "adhd" or "deaf". */
export function normsMatching(text: string): NormChoice[] {
  const q = text.trim().toLowerCase()
  if (q.length < 2) return []
  return ALL_NORMS.filter((n) => {
    if (isOtherNorm(n.id)) return false
    const label = n.label.toLowerCase()
    return (
      n.id === q ||
      label.startsWith(q) ||
      label.split(/[\s/()-]+/).some((w) => w.length >= 3 && w.startsWith(q))
    )
  })
}

/**
 * The norm a whole search is about, when it is exactly one: "adhd" or
 * "autism" are, "school near me" is not. Used to offer adding it as a topic.
 */
export function normForSearch(query: string): NormChoice | undefined {
  const q = query.trim().toLowerCase()
  if (q.length < 3) return undefined
  const exact = ALL_NORMS.find((n) => !isOtherNorm(n.id) && (n.id === q || n.label.toLowerCase() === q))
  if (exact) return exact
  const starts = ALL_NORMS.filter((n) => !isOtherNorm(n.id) && n.label.toLowerCase().startsWith(q))
  return starts.length === 1 ? starts[0] : undefined
}

export interface SetupNeed {
  /** The same ids as the needs in Goal Planning's "Start here"
   *  (frontend/lib/startHere.ts, START_GOALS), so both apps ask alike. */
  id: string
  label: string
  hint: string
  /** ResourceHub searches that find it, best first; the first is "see more". */
  searches: Record<string, string>[]
  /** Shop categories (lib/shop/categories.ts), when it is things to buy. */
  shop?: string[]
}

export const SETUP_NEEDS: SetupNeed[] = [
  {
    id: 'services',
    label: 'Services',
    hint: 'Therapists, doctors and other places that can help',
    searches: [{ categories: 'Therapist,Doctor' }],
  },
  {
    id: 'community',
    label: 'People with similar experiences',
    hint: 'Support groups, community centres and activities',
    searches: [{ categories: 'Support Group,Community Center,Recreation' }],
  },
  {
    id: 'school_work',
    label: 'School or work support',
    hint: 'Schools, jobs and careers',
    searches: [{ categories: 'School' }, { lifeAreas: 'workplace' }],
  },
  {
    id: 'sensory',
    label: 'Sensory tools',
    hint: 'For noise, light and touch',
    searches: [{ categories: 'self-care,toys,supplies,clothing' }],
    shop: ['self-care', 'toys', 'supplies', 'clothing'],
  },
]

export const MAX_SETUP_NEEDS = 2

export const findNeed = (id: string) => SETUP_NEEDS.find((n) => n.id === id)

/** The needs whose searches cover a ResourceHub category, e.g. "Therapist". */
export function needsForCategory(category: string): SetupNeed[] {
  const c = category.trim().toLowerCase()
  return SETUP_NEEDS.filter((n) =>
    n.searches.some((s) => (s.categories || '').toLowerCase().split(',').includes(c))
  )
}

/** A ResourceHub search link. */
export function searchHref(params: Record<string, string>): string {
  const qs = new URLSearchParams(params).toString()
  return qs ? `/search?${qs}` : '/search'
}

/** Only the ids this app knows, in their own order, without repeats. */
export function cleanNeeds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids = new Set(value.filter((v): v is string => typeof v === 'string'))
  return SETUP_NEEDS.filter((n) => ids.has(n.id)).map((n) => n.id)
}
