/**
 * When the optional setup questions someone skipped come back on the Path
 * (app/components/AskLaterCard.tsx), in days after sign-up.
 *
 * Riipen Labs, Group 5: "essential account setup is captured on Day 1, while
 * deeper preferences (sensory needs, specific conditions) are gathered
 * gradually over Days 7 to 14". One group at a time: location first (it finds
 * services near them), sensory needs and conditions from day 7, the personal
 * touches from day 10. Closing a group moves on to the next once it is due.
 */

export interface AskLaterGroup {
  ids: string[]
  fromDay: number
  title: string
  intro: string
}

export const ASK_LATER_GROUPS: AskLaterGroup[] = [
  { ids: ['location'], fromDay: 0, title: 'Find services near you (optional)', intro: 'You skipped this during setup. Add it whenever you like.' },
  { ids: ['aboutYou'], fromDay: 7, title: 'Help it fit you better (optional)', intro: 'Now that you have used Autinerary for a while, you can tell it more. Only what you choose, and you can change it any time.' },
  { ids: ['character', 'spiritAnimal', 'personalize'], fromDay: 10, title: 'Make it yours (optional)', intro: 'You skipped these during setup. Add any of them whenever you like.' },
]

/** The group to show `day` days after sign-up, if any is due. */
export function dueAskLaterGroup(items: string[], day: number): AskLaterGroup | undefined {
  return ASK_LATER_GROUPS.find((g) => day >= g.fromDay && g.ids.some((id) => items.includes(id)))
}
