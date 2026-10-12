/**
 * "Who are you here for?": setup's first question, and the same choice in
 * Settings.
 *
 * The answer decides what the app shows first: the order of the Path's Quick
 * Links (lib/places.ts), the card for planning for someone else, and Start
 * here's suggestions. Riipen Labs, Group 32: "siblings or parents need
 * assurance that their selected role will tailor the content visible to
 * them", and a role prompt for "parent, sibling, caregiver, healthcare
 * professional, or neurodivergent user". So the two answers that cover
 * several roles say which (`hint`), setup says what the answer changes, the
 * Path says whose order its Quick Links are in, and Settings can change it.
 *
 * Plain data, no imports.
 */

export interface Audience {
  id: string
  label: string
  /** Who else the answer covers, under the label. */
  hint?: string
  /** The Norms step connection type it pre-selects; null where the right one
   * is ambiguous (the person picks it). */
  connection: string | null
  /** Finishes "Quick Links are in the order for …". */
  orderFor: string
}

export const AUDIENCES: Audience[] = [
  { id: 'self', label: 'Myself', connection: 'self', orderFor: 'planning for yourself' },
  { id: 'child', label: 'My child', connection: 'parent', orderFor: 'a parent' },
  { id: 'family', label: 'Another family member', hint: 'For example a sibling, partner or parent', connection: null, orderFor: 'supporting someone in your family' },
  { id: 'friend', label: 'A friend', connection: 'friend', orderFor: 'supporting a friend' },
  { id: 'work', label: 'Someone I teach, support or work with', hint: 'As a teacher, caregiver, health professional or employer', connection: null, orderFor: 'supporting people you teach or work with' },
  { id: 'ally', label: "I'm an ally, or just learning", connection: 'ally', orderFor: 'allies and people learning' },
  // Riipen Labs, Group 4: "Include 'not sure' to avoid blocking progress".
  // Setup then reads as if for themselves, the default.
  { id: 'unsure', label: 'Not sure yet', connection: null, orderFor: 'planning for yourself' },
]

// The same answers under three headings (Riipen Labs, Group 34, slide 25:
// "Who are you?" in three groups). Their mockup's first group was
// "Neurodivergent"; it is "Yourself" here, since not everyone planning for
// themselves uses that word. "Not sure yet" follows the groups.
export const AUDIENCE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Yourself', ids: ['self'] },
  { label: 'Family', ids: ['child', 'family'] },
  { label: 'Friends, work and others', ids: ['friend', 'work', 'ally'] },
]

// What Autinerary does for each of them, shown once they choose (Riipen Labs,
// Group 5: "make the value of Autinerary clearer for each user group during
// onboarding"). Matches what "Start here" says for the same answer.
export const AUDIENCE_VALUE: Record<string, string> = {
  self: 'You’ll turn your goal into small, clear steps planned around your energy, and find services rated by people with similar norms.',
  child: 'You’ll plan a goal you are working on together in small, clear steps, and find services and places for families. If your child is under 18, you can add them from the Family page.',
  family: 'You’ll plan a goal you are helping with in small, clear steps, and find services and ideas that fit how they work.',
  friend: 'You’ll plan a goal you are helping with in small, clear steps, and find services and ideas that fit how they work.',
  work: 'You’ll plan a goal you are helping with in small, clear steps, and find tools and services to recommend.',
  ally: 'You’ll learn from questions and answers in Tidbits, browse services, and can start a plan of your own.',
  unsure: 'That’s fine. You’ll get one goal turned into small, clear steps, and can explore the rest whenever you like.',
}

/** What the answer changes, said where it is asked. */
export const AUDIENCE_EFFECT = 'Your answer decides what the app shows you first. You can change it later in Settings.'

export function audienceById(id: string | null | undefined): Audience | undefined {
  return AUDIENCES.find((a) => a.id === id)
}
