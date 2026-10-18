/**
 * Community's Choice's calendar (the team's planning note, October 2026,
 * Goal 5: "In the last week of the month, give an email notification for
 * users to vote ... IN OUR NEWSLETTER"; "Tally up votes at end of month").
 * Months are Toronto's, as in the database (STEP 79's choice_month()). The
 * newsletter goes out on Mondays (vercel.json), so its last Monday of a month
 * carries the vote, and the tally runs on the 1st for the month before.
 * No imports, so its test runs on its own.
 */

const ZONE = 'America/Toronto'

/** 'YYYY-MM-DD' in Toronto. */
export function torontoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 'YYYY-MM' in Toronto. */
export function torontoMonth(now: Date): string {
  return torontoDate(now).slice(0, 7)
}

/** Whether a week from this date is next month: the month's last week. */
export function isLastWeek(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return false
  const later = new Date(Date.UTC(y, m - 1, d + 7))
  return later.getUTCMonth() !== m - 1
}

/** The month before, 'YYYY-MM'. */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** "October", or "October 2026" with the year. */
export function monthName(month: string, withYear = false): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, 15)).toLocaleDateString('en-CA', {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}

/** Whether voting for this month is open now: its last week, before it ends (Toronto). */
export function votingOpen(month: string, now: Date): boolean {
  const today = torontoDate(now)
  return today.slice(0, 7) === month && isLastWeek(today)
}
