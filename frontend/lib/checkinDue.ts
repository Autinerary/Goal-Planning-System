/**
 * Which in-app check-in is due on the Path, if any (components/CheckinPrompt.tsx).
 * Plain data and one pure function, no imports, so lib/checkinDue.test.mjs
 * can check every case.
 *
 *   welcome back  first visit after two weeks or more away, since signing up:
 *                 what got in the way? Once per absence.
 *   day 3         days 3 to 6 after sign-up (Riipen Labs, Group 12: "Trigger
 *                 quick micro-surveys on Day 3 and Day 7"): how is it going,
 *                 and is anything in the way? Once.
 *   usefulness    from day 7 (Group 12's day 7; Group 5's "week two"): is it
 *                 useful so far? Once, and never on the day of the day-3
 *                 question.
 *
 * Both of the last two wait until the questions after setup are done (and not
 * on that day), and until someone has come back on a second day.
 */

export const EARLY_FROM_DAY = 3
export const EARLY_UNTIL_DAY = 6
export const WEEK_TWO_FROM_DAY = 7

export interface CheckinFacts {
  /** The local day (YYYY-MM-DD) the account was made, or null. */
  joined: string | null
  /** Whole days since then (0 on the day). */
  day: number
  /** The last day before today this browser opened the app, or null. */
  lastVisit: string | null
  /** Whole days since that visit. */
  daysAway: number
  /** How long away counts as away (lib/checkin.ts, AWAY_DAYS). */
  awayDays: number
  /** Days this browser opened the app since joining, today included. */
  visitDays: number
  /** The questions after setup are done, and whether that was today. */
  feedbackDone: boolean
  feedbackToday: boolean
  /** The absence (its last visit day) already asked about, if any. */
  welcomeBackAskedFor: string | null
  earlyAsked: boolean
  /** The day-3 question was answered or put off today. */
  earlyToday: boolean
  usefulnessAsked: boolean
}

export type CheckinDue = { kind: 'welcome_back'; lastVisit: string } | { kind: 'early' } | { kind: 'usefulness' } | null

export function checkinDue(f: CheckinFacts): CheckinDue {
  // Visits before the account existed (the landing page, say) are not an absence.
  if (f.lastVisit && f.joined && f.lastVisit >= f.joined && f.daysAway >= f.awayDays && f.welcomeBackAskedFor !== f.lastVisit) {
    return { kind: 'welcome_back', lastVisit: f.lastVisit }
  }
  const askable = f.feedbackDone && !f.feedbackToday && f.joined !== null && f.visitDays >= 2
  if (askable && f.day >= EARLY_FROM_DAY && f.day <= EARLY_UNTIL_DAY && !f.earlyAsked) return { kind: 'early' }
  if (askable && f.day >= WEEK_TWO_FROM_DAY && !f.usefulnessAsked && !f.earlyToday) return { kind: 'usefulness' }
  return null
}
