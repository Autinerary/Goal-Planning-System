/**
 * "Complete your profile": the optional questions that used to be setup's
 * extras, now asked in the app (components/ProfileCompletion.tsx).
 *
 * Riipen Labs, Groups 25 to 30 (September 2026): "move personalization
 * questions after users enter the app" (25); location to "profile
 * completion" (26); "everything else the app asks for now should move
 * inside, where it can come up at the moment it is useful" (28); character,
 * avatar and preferences on "an optional 'Complete Your Profile' card on the
 * main dashboard, allowing users to personalize their account whenever they
 * choose" (29); and "allow users to access the main platform before
 * completing every question, while keeping some features locked until
 * essential information is provided" (30). Each item says what answering it
 * changes, so the reason is visible (Group 28) and so is what it unlocks.
 *
 * The ids are sent in the funnel's ask_later events ("done.profile.<id>") and
 * listed in backend/scripts/onboarding_funnel.py (PROFILE_ITEMS). Plain data
 * and pure functions; tested by lib/profileItems.test.mjs.
 */

export type ProfileItemId = 'location' | 'norms' | 'motivation' | 'character' | 'spiritAnimal' | 'look' | 'reminders'

export interface ProfileItem {
  id: ProfileItemId
  title: string
  /** What answering it changes: why it is asked, and what it unlocks. */
  unlocks: string
  /** Where it is answered, when it is not answered on the card itself. */
  href?: string
  /** Answered on the card itself. */
  inline?: boolean
  /**
   * From which day after sign-up the card suggests it as the next one (Riipen
   * Labs, Group 5: "deeper preferences (sensory needs, specific conditions)
   * are gathered gradually over Days 7 to 14", the timing the Path's "ask
   * later" card used). "See all" lists every item from the first day.
   */
  fromDay: number
}

// In the order they are suggested: what helps in the first days first.
export const PROFILE_ITEMS: ProfileItem[] = [
  { id: 'location', title: 'Your city', unlocks: 'Unlocks services near you in ResourceHub, nearest first.', inline: true, fromDay: 0 },
  { id: 'reminders', title: 'Reminders for your first two weeks', unlocks: 'One short email a day about your next step. It stops by itself after two weeks.', inline: true, fromDay: 0 },
  { id: 'look', title: 'How the app looks', unlocks: 'Light or dark, larger text, higher contrast, and how lively it looks.', inline: true, fromDay: 0 },
  { id: 'motivation', title: 'What motivates you', unlocks: 'Helps match you with people motivated in similar ways when your plans are made.', inline: true, fromDay: 0 },
  { id: 'norms', title: 'Your norms and support needs', unlocks: 'Tools and services that fit how you work, and ratings from people with similar norms. Private.', href: '/profile/diagnostic', fromDay: 7 },
  { id: 'character', title: 'Your character and Dream Self', unlocks: 'Puts you on your race track, and a picture of who you are working toward on the Ideal Self page.', href: '/ideal-self', fromDay: 10 },
  { id: 'spiritAnimal', title: 'Your spirit animals', unlocks: 'A guide for the day at the top of your Path.', href: '/profile/settings#spirit-animals', fromDay: 10 },
]

export function profileItem(id: string): ProfileItem | undefined {
  return PROFILE_ITEMS.find((item) => item.id === id)
}

/** What decides whether each item is answered. */
export interface ProfileState {
  /** A city is saved on the profile. */
  hasCity: boolean
  /** Norms on the profile (user_barriers), or a saved private profile. */
  hasNorms: boolean
  motivation?: { types?: string[] } | null
  character?: unknown
  gamification?: { animals?: { type?: string }[] } | null
  viewPreference?: string | null
  accessibility?: { darkMode?: boolean; highContrast?: boolean; fontScale?: string } | null
  reminders?: { enabled?: boolean } | null
}

export function itemDone(id: ProfileItemId, state: ProfileState): boolean {
  switch (id) {
    case 'location': return state.hasCity
    case 'norms': return state.hasNorms
    case 'motivation': return (state.motivation?.types?.length || 0) > 0
    case 'character': return Boolean(state.character)
    case 'spiritAnimal': return (state.gamification?.animals || []).some((a) => Boolean(a?.type))
    case 'look': {
      const a = state.accessibility || {}
      return Boolean(state.viewPreference) || Boolean(a.darkMode) || Boolean(a.highContrast) || (Boolean(a.fontScale) && a.fontScale !== 'default')
    }
    case 'reminders': return Boolean(state.reminders?.enabled)
  }
}

/**
 * The one the card suggests next, `day` days after sign-up: the first not yet
 * answered whose day has come, or, when none has, the first not answered.
 * Reminders for the first two weeks are not suggested after them.
 */
export function nextProfileItem(todo: ProfileItemId[], day: number): ProfileItemId | undefined {
  const open = todo.filter((id) => !(id === 'reminders' && day >= 14))
  return open.find((id) => day >= (profileItem(id)?.fromDay ?? 0)) ?? open[0]
}

/** Done and not done, in the card's order. */
export function profileProgress(state: ProfileState): { done: ProfileItemId[]; todo: ProfileItemId[] } {
  const done: ProfileItemId[] = []
  const todo: ProfileItemId[] = []
  for (const item of PROFILE_ITEMS) (itemDone(item.id, state) ? done : todo).push(item.id)
  return { done, todo }
}
