/**
 * Community's Choice (the team's planning note, October 2026, Goal 5:
 * "Nominate the Best (monthly, newsletter)"): through each month anyone
 * signed in may nominate services, shop items and articles; in the month's
 * last week the newsletter carries a vote among the most nominated; the
 * winners get the Community's Choice badge. Months are Toronto's (STEP 79's
 * choice_month()).
 */

export const CHOICE_DISCLAIMER =
  "Community's Choice services are chosen through monthly nomination rounds, where all users can nominate a service."

/** 'YYYY-MM' in Toronto. */
export function torontoMonth(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value || ''
  return `${get('year')}-${get('month')}`
}

/** "October", for "October's Community's Choice". */
export function monthName(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, 15)).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' })
}
