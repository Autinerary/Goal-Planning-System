/**
 * Emails for someone's first two weeks: on day 1, day 7 and day 14 after
 * they joined, each about what they actually did, with one next thing.
 *
 * Riipen Labs, Group 15 (September 2026): "Milestone-based emails, not a
 * newsletter: Day 1, Day 7, and Day 14 emails tied to what the user
 * actually did, not a generic digest." Their touchpoint map:
 *   Day 1-2   "Confirms the win, links back to the exact spot they left off"
 *   Day 7     "Recap of what they've explored; invites a community action"
 *   Day 14    "Asks for feedback and introduces the paid/expanded tier where
 *             relevant"
 *
 * Only for people who ask for them (Settings, or "Reminders for your first
 * two weeks" on the Complete your profile card), with the words they agreed
 * to kept as the consent record. Sent by the hourly run (lib/reminderRun.ts)
 * between 10:00 and 19:59 where they live, at most one a run, never twice.
 * An email whose days have passed is not sent late: day 1 goes on days 1 to
 * 3, day 7 on days 7 to 10, day 14 on days 14 to 17. Every one can stop the
 * rest in one click.
 *
 * Plain data and pure functions; tested by lib/firstWeeks.test.mjs. The
 * email itself is in lib/email.ts (firstWeeksEmail).
 */

// The same rules as lib/reminderSchedule.ts (localParts, validTimeZone),
// repeated here so this file has no imports and its test runs on its own.
const DEFAULT_TIME_ZONE = 'America/Toronto'

function validTimeZone(timeZone: unknown): string {
  if (typeof timeZone !== 'string' || !timeZone) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function localParts(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 }
}


export const FIRST_WEEKS_DAYS = [1, 7, 14] as const
export type FirstWeeksDay = (typeof FIRST_WEEKS_DAYS)[number]

/** The words someone agrees to, kept with the choice. */
export const FIRST_WEEKS_CONSENT =
  'Three emails about my first two weeks: the day after I joined, after a week and after two weeks, each about what I have done and one next thing.'

export interface FirstWeeksChoice {
  enabled: boolean
  /** What they agreed to, word for word (FIRST_WEEKS_CONSENT). */
  consent?: string
  /** When they asked for them. */
  startedAt?: string
  /** Where they live, for the sending hours. */
  timeZone?: string
  /** When each was sent. */
  sent?: Partial<Record<`day${FirstWeeksDay}`, string>>
  /** The first time a link in one was opened. */
  clicked?: string
  /** Stopped, from an email or Settings. */
  stoppedAt?: string | null
}

/** On which days after joining each email may still go (later is too late to help). */
const WINDOWS: Record<FirstWeeksDay, [number, number]> = { 1: [1, 3], 7: [7, 10], 14: [14, 17] }
const FIRST_HOUR = 10
const LAST_HOUR = 19

/** Whole days from the day they joined to today, both where they live. */
export function dayOfAccount(accountCreated: string | Date, timeZone: string | undefined, now: Date): number {
  const zone = validTimeZone(timeZone)
  const joined = localParts(new Date(accountCreated), zone).date
  const today = localParts(now, zone).date
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${joined}T00:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

/** Which email is due now, or null. */
export function firstWeeksDue(choice: FirstWeeksChoice | null | undefined, accountCreated: string | null | undefined, now: Date): FirstWeeksDay | null {
  if (!choice?.enabled || !choice.consent || choice.stoppedAt || !accountCreated) return null
  if (Number.isNaN(new Date(accountCreated).getTime())) return null
  const hour = localParts(now, validTimeZone(choice.timeZone)).hour
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return null
  const day = dayOfAccount(accountCreated, choice.timeZone, now)
  for (const d of FIRST_WEEKS_DAYS) {
    const [from, to] = WINDOWS[d]
    if (day >= from && day <= to && !choice.sent?.[`day${d}`]) return d
  }
  return null
}

/** Whether there is still an email to come, so the choice is worth offering. */
export function firstWeeksStillAhead(accountCreated: string | null | undefined, timeZone: string | undefined, now: Date): boolean {
  if (!accountCreated) return true
  return dayOfAccount(accountCreated, timeZone, now) <= WINDOWS[14][1]
}

/** What the emails say, from what the person did. Only true counts. */
export interface FirstWeeksFacts {
  /** Their plan's goal, if they have one. */
  goal: string | null
  /** The first step not done yet, if any. */
  nextStep: { id: string; name: string } | null
  stepsDone: number
  stepsTotal: number
  /** Places saved in ResourceHub since joining. */
  savedPlaces: number
  /** Days they opened the app since joining (counted where counting is allowed). */
  daysOpened: number
  journalEntries: number
  /** Who they are here for (lib/audiences.ts). */
  audience: string | null
}

/** One thing to try in week two, with people (Group 15: "invites a community action"). */
export function communityAction(audience: string | null): { text: string; label: string; href: string } {
  const tidbits = '/go/servicehub?next=/community'
  switch (audience) {
    case 'child':
    case 'family':
    case 'friend':
      return { text: 'See what other parents and families have asked in Tidbits, and ask your own. You post under a made-up name.', label: 'Open Tidbits', href: tidbits }
    case 'work':
      return { text: 'Answer a question in Tidbits from what you have seen work. You post under a made-up name.', label: 'Open Tidbits', href: tidbits }
    case 'ally':
      return { text: 'Read what neurodivergent people and their families say in Tidbits.', label: 'Open Tidbits', href: tidbits }
    default:
      return { text: 'Ask or answer one question in Tidbits, where people with similar experiences share what worked. You post under a made-up name.', label: 'Open Tidbits', href: tidbits }
  }
}

/** "1 step", "2 steps". */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** The lines of the week-one recap, each something they did. */
export function recapLines(f: FirstWeeksFacts): string[] {
  const lines: string[] = []
  if (f.daysOpened > 0) lines.push(`You opened Autinerary on ${count(f.daysOpened, 'day', 'days')}.`)
  if (f.stepsDone > 0) lines.push(`You finished ${count(f.stepsDone, 'step', 'steps')}${f.stepsTotal ? ` of ${f.stepsTotal}` : ''}.`)
  if (f.savedPlaces > 0) lines.push(`You saved ${count(f.savedPlaces, 'place', 'places')} in ResourceHub.`)
  if (f.journalEntries > 0) lines.push(`You wrote ${count(f.journalEntries, 'journal entry', 'journal entries')}.`)
  return lines
}
