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
  /** The one email of the first version (Group 11). */
  sentAt?: string
  closedAt?: string
  /** Up to three emails (Groups 20 and 24); without it, the one-email version. */
  plan?: 'sequence'
  /** Who they are here for, so the email can say the right thing to a parent. */
  audience?: string | null
  /** When each email went. */
  sends?: string[]
  /** "Remind me in a few days": nothing before this day where they live ("YYYY-MM-DD"). */
  snoozeUntil?: string | null
  snoozes?: number
  stoppedAt?: string
  /** Last opened setup from an email. */
  clickedAt?: string
}

/** At most this many emails, then never again (Group 24: "capping frequency"). */
export const SETUP_REMINDER_MAX = 3

/** Emails go out between these hours where the person lives. */
const FIRST_HOUR = 9
const LAST_HOUR = 20

/** "YYYY-MM-DD" plus whole days. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/**
 * Which reminder to finish setup is due now: 1, 2 or 3, or null.
 *
 * Riipen Labs, Group 24 (September 2026): "a same-day nudge, a Day 3 follow-up,
 * and a Day-7 final reminder", with "user-selected snooze intervals (e.g., 3
 * or 7 days)"; Group 20: the reminder was "the employer's own idea", and "its
 * tone should stay positive". So: the first one at least three hours after
 * asking, the same day if it is still daytime where they live, otherwise the
 * next morning; the second three days after asking, the third a week after;
 * a snooze moves the next one to the day they chose. Only between 9 AM and 8 PM
 * where they live, never after they stop them, and never more than three.
 *
 * The first version sent one email, at 9 the next morning; an ask saved by it
 * (no `plan`) still gets just that one.
 */
export function setupReminderDue(ask: SetupReminderAsk | null | undefined, now: Date): number | null {
  if (!ask?.requestedAt || ask.closedAt || ask.stoppedAt) return null
  const asked = new Date(ask.requestedAt)
  if (Number.isNaN(asked.getTime()) || asked > now) return null
  const zone = validTimeZone(ask.timeZone)
  const today = localParts(now, zone)
  const askedOn = localParts(asked, zone).date

  if (ask.plan !== 'sequence') {
    if (ask.sentAt) return null
    return today.hour === 9 && today.date > askedOn ? 1 : null
  }

  const sends = ask.sends || []
  const sent = sends.length
  if (sent >= SETUP_REMINDER_MAX) return null
  if (today.hour < FIRST_HOUR || today.hour > LAST_HOUR) return null
  // Never two within three days, so a snooze cannot bunch them up.
  const last = sent ? new Date(sends[sent - 1]) : null
  if (last && !Number.isNaN(last.getTime()) && today.date < addDays(localParts(last, zone).date, 3)) return null
  if (ask.snoozeUntil && /^\d{4}-\d{2}-\d{2}$/.test(ask.snoozeUntil)) {
    return today.date >= ask.snoozeUntil ? sent + 1 : null
  }
  if (sent === 0) {
    // The same day, three hours on; or any later day, from 9 AM.
    return today.date > askedOn || now.getTime() - asked.getTime() >= 3 * 3_600_000 ? 1 : null
  }
  return today.date >= addDays(askedOn, sent === 1 ? 3 : 7) ? sent + 1 : null
}

/** The day a snooze of `days` ends, where they live. */
export function snoozeUntil(now: Date, timeZone: string | undefined, days: number): string {
  return addDays(localParts(now, validTimeZone(timeZone)).date, days)
}
