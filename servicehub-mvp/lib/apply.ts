/**
 * One-click Apply lives in the app (frontend/lib/applications.ts, STEP 89):
 * Autinerary emails the service for the person, so nobody goes to a
 * service's own website to apply. ResourceHub links each listing to the
 * app's Apply page and lists the person's applications in My Resources.
 * Off unless NEXT_PUBLIC_ONE_CLICK_APPLY=on, here and in the app.
 */
export const APPLY_ON = process.env.NEXT_PUBLIC_ONE_CLICK_APPLY === 'on'

// Places you just go to: the same list as the app's (lib/applications.ts).
const PLACES = new Set(['restaurant', 'café', 'cafe', 'park', 'bank', 'hotel', 'museum', 'amusement park', 'zoo & aquarium', 'cinema', 'store'])

export const canApplyTo = (category: string | null | undefined): boolean => !PLACES.has(String(category || '').trim().toLowerCase())

// The app, as lib/appSignIn.ts has it (no imports here, so lib/apply.test.mjs can load this file).
const APP = (process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000').replace(/\/$/, '')

/** The app's Apply page for this listing. */
export const applyHref = (resourceId: string): string => `${APP}/apply/${resourceId}`

export type ApplicationStatus = 'sent' | 'waiting' | 'cancelled' | 'failed' | 'unreachable'

/** The same words as the app's statusLabel(). */
export function applicationLabel(status: ApplicationStatus, at: string | null): string {
  const day = at ? new Date(at).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' }) : ''
  if (status === 'sent') return day ? `Applied ${day}` : 'Applied'
  if (status === 'waiting') return 'Applied: we’re finding their email address'
  if (status === 'unreachable') return 'We couldn’t reach them by email'
  if (status === 'failed') return 'Didn’t send. Try again in Autinerary'
  return ''
}
