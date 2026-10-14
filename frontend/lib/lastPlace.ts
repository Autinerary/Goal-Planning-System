/**
 * Where someone was last in the app, so the Path can offer "Pick up where you
 * left off" when they come back (Riipen Labs, Group 16: personalise "based on
 * user behaviour rather than user input"; Group 15: "links back to the exact
 * spot they left off"). Kept in this browser only, for the account that was
 * signed in, and never sent anywhere. Plain data and pure functions; tested
 * by lib/lastPlace.test.mjs.
 */

export interface LastPlace {
  /** The page's address, e.g. /milestones/m_1 or /calendar. */
  path: string
  /** When it was opened (ms since 1970). */
  at: number
  /** Whose account it was. */
  user: string
}

// Pages worth going back to, with their names. Anything else (the Path
// itself, setup, sign-in, Settings) is not offered.
const PLACES: [RegExp, string][] = [
  [/^\/milestones\/[^/]+$/, 'step'],
  [/^\/calendar$/, 'Calendar'],
  [/^\/tasks$/, 'Tasks'],
  [/^\/races$/, 'Races'],
  [/^\/reflection$/, 'Journal'],
  [/^\/pit-stop$/, 'Pit Stop'],
  [/^\/tools$/, 'Tools for your steps'],
  [/^\/recommend-choices$/, 'Suggestions for each step'],
  [/^\/hare-world$/, 'Hare World'],
  [/^\/ideal-self$/, 'Ideal Self'],
  [/^\/stats$/, 'Life Stats'],
  [/^\/path-market$/, 'Path Market'],
  [/^\/kits\/[a-z-]+$/, 'starter kit'],
  [/^\/start$/, 'Starter resources'],
  [/^\/assistant$/, 'Assistant'],
]

/** The name to show for a page, or null if it is not one to go back to. */
export function placeName(path: string): string | null {
  return PLACES.find(([pattern]) => pattern.test(path))?.[1] ?? null
}

/** Long enough away that it is a new visit, not a quick look at the Path. */
export const AWAY_MS = 30 * 60 * 1000
/** Too long ago to be "where you left off". */
export const STALE_MS = 21 * 24 * 60 * 60 * 1000

/** The place to offer on the Path now, or null. */
export function placeToOffer(last: LastPlace | null, user: string, now: number, visitStartedAt: number): LastPlace | null {
  if (!last || last.user !== user || !placeName(last.path)) return null
  // Only from an earlier visit: not the page they opened a moment ago.
  if (visitStartedAt - last.at < AWAY_MS) return null
  if (now - last.at > STALE_MS) return null
  return last
}
