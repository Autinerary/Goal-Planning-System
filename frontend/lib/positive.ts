/**
 * The Positivity Quota (the planning note's Goal 11: "Make sure a positive
 * message is on each page (banners or sidebars), general or norm-specific").
 * Kept the same in both apps (servicehub-mvp/lib/positive.ts). Each follows
 * docs/voice.md: plain, calm, true, never deficit-framed, never urgent, and
 * no claims the app can't back up. Plain data, no imports
 * (lib/positive.test.mjs).
 */

export const GENERAL_NOTES = [
  'Small steps count. Whatever you do today is enough.',
  'You know yourself best. Go at the pace that works for you.',
  'Rest is part of the plan, too.',
  'There is no wrong way to plan. You can change anything, any time.',
  'Progress isn’t a straight line, and that’s okay.',
  'Asking for help is a skill, and you’re using it.',
  'Be as kind to yourself today as you would be to a friend.',
  'It’s okay to stop here and come back later. Everything stays where you left it.',
  'Other people with similar experiences are here too. You’re not doing this alone.',
  'Noticing what works for you is real progress.',
  'A plan that fits you is better than a perfect plan.',
  'You’re allowed to take up space and ask for what you need.',
] as const

/** Keyed by the norms' ids (servicehub-mvp/lib/norms/taxonomy.ts). */
export const NORM_NOTES: Record<string, readonly string[]> = {
  autism: ['Your way of seeing the world is valuable. Plan around what works for you.', 'Wanting quiet, routine or a clear plan is a good reason, not an excuse.'],
  adhd: ['Starting is often the hardest part, and one small step counts.', 'Short bursts are a real way to get things done.'],
  ocd: ['Be patient with yourself. A hard day doesn’t undo your progress.'],
  bipolar: ['Your energy changes, and your plan can change with it.'],
  neurodivergence_other: ['Your brain works its own way, and your plan can too.'],
  sensory_deaf: ['You deserve services that talk with you in a way that works for you.'],
  sensory_blind: ['You deserve information in a form that works for you.'],
  physical_wheelchair: ['You deserve places that fit you. Ratings for your norms show what others found.'],
  physical_mobility: ['Plan for the days you have. Going at your own pace is still going.'],
  intellectual: ['Take your time. Nothing here is timed, and you can read it again whenever you like.'],
  disability_other: ['You deserve places and services that fit you as you are.'],
  race_visible_minority: ['Your culture and background belong here.'],
  ethnicity: ['Your culture and background belong here.'],
  language: ['Your language and culture matter here.'],
  gender: ['You belong here, as you are.'],
  lgbtq: ['You belong here, as you are.'],
  socioeconomic: ['Many services cost nothing. Look for “Free” on a listing.'],
  chronic_health: ['Your energy is real. Plan for the days you have.'],
  mental_health: ['Hard days are part of it, and they pass. If you need someone now, call or text 9-8-8.'],
  depression: ['Hard days are part of it, and they pass. If you need someone now, call or text 9-8-8.'],
  substance_use: ['Every day you choose is worth something. Recovery isn’t a straight line.'],
}

/** Norm names as people's profiles store them (an id, or the label shown in setup), as ids. */
const LABELS: Record<string, string> = {
  'autism spectrum': 'autism', autism: 'autism', adhd: 'adhd', ocd: 'ocd', 'bipolar disorder': 'bipolar', bipolar: 'bipolar',
  'deaf or hard of hearing': 'sensory_deaf', 'blind or low vision': 'sensory_blind', 'wheelchair user': 'physical_wheelchair',
  'mobility challenges': 'physical_mobility', 'intellectual disabilities': 'intellectual', 'race/visible minority': 'race_visible_minority',
  ethnicity: 'ethnicity', 'primary language': 'language', 'gender identity': 'gender', 'lgbtq+': 'lgbtq',
  'socioeconomic considerations': 'socioeconomic', 'chronic health conditions': 'chronic_health',
  'mental health considerations': 'mental_health', depression: 'depression', 'substance use / recovery': 'substance_use',
}

export function normIds(names: readonly string[]): string[] {
  return Array.from(new Set(names.map((n) => String(n || '').trim()).map((n) => (NORM_NOTES[n] ? n : LABELS[n.toLowerCase()] || '')).filter(Boolean)))
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Today's note for a place in the app: the same all day (no flicker, nothing
 * changing while someone reads), different between places and days. With
 * norms, every other day is a note for one of them.
 */
export function noteFor(day: string, place: string, norms: readonly string[] = []): string {
  const h = hash(`${day}|${place}`)
  const forNorms = norms.flatMap((n) => NORM_NOTES[n] || [])
  if (forNorms.length && h % 2 === 0) return forNorms[(h >>> 1) % forNorms.length]
  return GENERAL_NOTES[h % GENERAL_NOTES.length]
}

/** Today in Toronto, as YYYY-MM-DD. */
export const today = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })

export const POSITIVE_OFF_KEY = 'autinerary_positive_notes'
