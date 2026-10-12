/**
 * The optional questions setup skipped, asked later on the Path.
 *
 * Riipen Labs, Group 5: "essential account setup is captured on Day 1, while
 * deeper preferences (sensory needs, specific conditions) are gathered
 * gradually over Days 7 to 14". The Path's "ask later" card showed these
 * groups one at a time: location first, sensory needs and conditions from day
 * 7, the personal touches from day 10. Groups 25 to 30 moved every optional
 * question out of setup, and the "Complete your profile" card
 * (components/ProfileCompletion.tsx, lib/profileItems.ts) replaced that card,
 * with the same timing for what it suggests next.
 *
 * The groups stay for the funnel's ask_later events (app/api/events), which
 * the profile card sends too: "shown.profile" and "done.profile.<item>".
 */

import { PROFILE_ITEMS } from './profileItems'

export interface AskLaterGroup {
  /** Names the group in the funnel events (ask_later). */
  id: string
  ids: string[]
  fromDay: number
  title: string
  intro: string
}

export const ASK_LATER_GROUPS: AskLaterGroup[] = [
  { id: 'location', ids: ['location'], fromDay: 0, title: 'Find services near you (optional)', intro: 'You skipped this during setup. Add it whenever you like.' },
  { id: 'aboutYou', ids: ['aboutYou'], fromDay: 7, title: 'Help it fit you better (optional)', intro: 'Now that you have used Autinerary for a while, you can tell it more. Only what you choose, and you can change it any time.' },
  { id: 'makeItYours', ids: ['character', 'spiritAnimal', 'personalize'], fromDay: 10, title: 'Make it yours (optional)', intro: 'You skipped these during setup. Add any of them whenever you like.' },
]

// The "Complete your profile" card's items.
const PROFILE_ITEM_IDS = PROFILE_ITEMS.map((item) => item.id)

/**
 * Steps of the ask_later event: "shown.aboutYou", "done.location",
 * "closed.makeItYours"; and the profile card's "shown.profile" and
 * "done.profile.motivation".
 */
export const ASK_LATER_STEP = new RegExp(
  `^((shown|done|closed)\\.(${[...new Set(ASK_LATER_GROUPS.flatMap((g) => [g.id, ...g.ids]))].join('|')})` +
    `|shown\\.profile|done\\.profile\\.(${PROFILE_ITEM_IDS.join('|')}))$`,
)
