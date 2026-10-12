// When a daily reminder is due, in the person's own time zone.
//
// Riipen Labs, Group 11: "Users choose the timing." Vercel runs the send once
// an hour (vercel.json: one daily job per hour, /api/cron/reminders/[hour]),
// and each run sends to the people whose chosen time it is where they live.
// Pure functions, shared by the settings UI and the send (lib/reminderRun.ts).

export const DEFAULT_TIME_ZONE = 'America/Toronto'

/** Preset send times (value is "HH:MM", 24h, in the person's time zone). */
export const REMINDER_TIMES: { id: string; label: string }[] = [
  { id: '09:00', label: 'Morning · 9 AM' },
  { id: '12:00', label: 'Midday · 12 PM' },
  { id: '18:00', label: 'Evening · 6 PM' },
  { id: '21:00', label: 'Night · 9 PM' },
]

/** The hour a reminder goes out, from its "HH:MM" time. Morning if unreadable. */
export function reminderHour(time: string | undefined | null): number {
  const hour = Number.parseInt(String(time || '').slice(0, 2), 10)
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9
}

/** A real IANA time zone, or Eastern time. */
export function validTimeZone(timeZone: unknown): string {
  if (typeof timeZone !== 'string' || !timeZone || timeZone.length > 64) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return timeZone
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/** This browser's time zone. */
export function browserTimeZone(): string {
  try {
    return validTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

/** "Eastern Time", "Pacific Time", ..., for saying when reminders arrive. */
export function timeZoneName(timeZone: string): string {
  const zone = validTimeZone(timeZone)
  for (const style of ['longGeneric', 'long'] as const) {
    try {
      const part = new Intl.DateTimeFormat('en-CA', { timeZone: zone, timeZoneName: style })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')
      if (part?.value) return part.value
    } catch {}
  }
  return zone
}

/** The calendar date ("YYYY-MM-DD") and hour (0-23) at `now` in a time zone. */
export function localParts(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: validTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 }
}

export interface ReminderChoice {
  enabled?: boolean
  consent?: boolean
  time?: string
  timeZone?: string
  /** The last day to send it ("YYYY-MM-DD" where they live); none means no end. */
  until?: string
}

/** Due now: opted in, their chosen hour where they live, not yet sent that day, and not past its last day. */
export function reminderDue(rem: ReminderChoice | null | undefined, lastSentOn: string | undefined, now: Date): string | null {
  if (!rem?.enabled || !rem.consent) return null
  const local = localParts(now, validTimeZone(rem.timeZone))
  if (local.hour !== reminderHour(rem.time) || lastSentOn === local.date) return null
  if (rem.until && /^\d{4}-\d{2}-\d{2}$/.test(rem.until) && local.date > rem.until) return null
  return local.date
}

/**
 * The last day of someone's first two weeks, where they live: "For my first
 * two weeks" stops there (Riipen Labs, Group 29: "gentle in-app and email
 * reminders during the first 7 to 14 days"). Counted from when the account
 * was made, so turning it on later does not stretch the two weeks.
 */
export function firstWeeksEnd(accountCreated: string | Date | null | undefined, timeZone: string, now: Date = new Date()): string {
  const created = accountCreated ? new Date(accountCreated) : now
  const start = Number.isNaN(created.getTime()) ? now : created
  return localParts(new Date(start.getTime() + 14 * 86_400_000), validTimeZone(timeZone)).date
}

export interface SetupReminderAsk {
  requestedAt?: string
  timeZone?: string
  sentAt?: string
  closedAt?: string
}

/** The one reminder to finish setup: the morning after it was asked for, at 9. */
export function setupReminderDue(ask: SetupReminderAsk | null | undefined, now: Date): boolean {
  if (!ask?.requestedAt || ask.sentAt || ask.closedAt) return false
  const asked = new Date(ask.requestedAt)
  if (Number.isNaN(asked.getTime()) || asked > now) return false
  const zone = validTimeZone(ask.timeZone)
  const today = localParts(now, zone)
  return today.hour === 9 && today.date > localParts(asked, zone).date
}
