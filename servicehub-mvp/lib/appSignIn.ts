/**
 * Signing in to ResourceHub is signing in to Autinerary: one account (both
 * apps share one Supabase project). Riipen Labs, Group 22: "a second sign in
 * at Resource Hub before anything can be saved"; Group 24: "Secondary login
 * wall for ResourceHub breaks task flow and raises skepticism". So ResourceHub
 * sends people to the app's sign-in, which comes straight back through its
 * hand-off (app/auth/handoff); someone already signed in to the app is back
 * at once, signed in here too.
 */
const APP = (process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'http://localhost:3000').replace(/\/$/, '')

/** The app's sign-in, coming back to `back` (a ResourceHub path such as /resources/123?then=save). */
export function appSignInHref(back: string): string {
  const path = back.startsWith('/') && !back.startsWith('//') ? back : '/'
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${APP}/login?returnTo=${encodeURIComponent(`${origin}${path}`)}`
}

/** The app's sign-up, for a new account (setup there, then back here from its menu). */
export const APP_SIGNUP = `${APP}/signup`

/** The app's calendar, where "Add to my team" puts the first meeting (lib/team.ts). */
export const APP_CALENDAR = `${APP}/calendar`

/** "How Autinerary uses AI", in the app's glossary. */
export const APP_AI_HELP = `${APP}/help#ai`
