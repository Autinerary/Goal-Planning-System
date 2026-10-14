/**
 * Which display choices people turn on (Riipen Labs, Group 16: "the employer
 * should also see which colour options are most popularly being chosen by
 * users"). One feature_use event per choice, the first time it is turned on
 * each day in a browser, counted in the funnel report's "Display choices"
 * (backend/scripts/onboarding_funnel.py, DISPLAY_CHOICES). Only that a
 * choice was made: nothing typed, and nothing when a choice is turned off.
 */

import { track, DISPLAY_CHOICE_IDS } from '@/lib/funnel'

export type DisplayChoice = (typeof DISPLAY_CHOICE_IDS)[number]

const DAYS_KEY = 'autinerary_display_choice_days'

export function trackDisplayChoice(choice: DisplayChoice): void {
  if (!(DISPLAY_CHOICE_IDS as readonly string[]).includes(choice)) return
  try {
    const today = new Date().toISOString().slice(0, 10)
    const days = JSON.parse(localStorage.getItem(DAYS_KEY) || '{}')
    if (days[choice] === today) return
    days[choice] = today
    localStorage.setItem(DAYS_KEY, JSON.stringify(days))
  } catch {
    return
  }
  track('feature_use', choice)
}
