// Cookies and counting: what this browser has agreed to (components/CookieConsent, Settings → Emails and
// notifications, app/cookies). Essential storage (signing in, settings) needs no yes. Counting how the app is used
// (lib/funnel.ts, the order of pages opened in lib/movement.ts, and Google Analytics when it is set up,
// lib/analytics.ts) waits for one: nothing is counted, and no
// visitor ID is made, until someone presses Allow. A browser sending Global Privacy Control or Do Not Track counts as
// a no, whatever was pressed. Plain functions, so they can be tested.

export type Consent = 'yes' | 'no'

export const CONSENT_KEY = 'autinerary_cookie_consent'
/** The Google Analytics answer before November 2026, read once as this browser's answer. */
const OLD_GA_KEY = 'autinerary_ga_consent'
/** What counting keeps in this browser (lib/funnel.ts), removed when someone says no. */
export const COUNTING_KEYS = ['autinerary_visitor_id', 'autinerary_first_touch', 'autinerary_area_days', 'autinerary_last_open_day', 'autinerary_movement']
export const CONSENT_CHANGED = 'autinerary:consent'
export const OPEN_COOKIE_SETTINGS = 'autinerary:cookie-settings'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Nav = { globalPrivacyControl?: boolean; doNotTrack?: string | null }

const store = (): Store | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** The browser itself asks not to be tracked (Global Privacy Control or Do Not Track). */
export function browserSaysNo(nav: Nav | null = typeof navigator === 'undefined' ? null : (navigator as Nav)): boolean {
  if (!nav) return true
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

/** This browser's answer, or null before it has given one. */
export function countingConsent(s: Store | null = store()): Consent | null {
  if (!s) return null
  try {
    const v = s.getItem(CONSENT_KEY)
    if (v === 'yes' || v === 'no') return v
    const old = s.getItem(OLD_GA_KEY)
    return old === 'yes' || old === 'no' ? old : null
  } catch {
    return null
  }
}

/** May this browser be counted? Only after a yes, and never when the browser says no. */
export function countingAllowed(s: Store | null = store(), nav?: Nav | null): boolean {
  return !browserSaysNo(nav === undefined ? (typeof navigator === 'undefined' ? null : (navigator as Nav)) : nav) && countingConsent(s) === 'yes'
}

/** Keep the answer. A no also removes what counting kept here. */
export function setCountingConsent(value: Consent, s: Store | null = store()): void {
  if (!s) return
  try {
    s.setItem(CONSENT_KEY, value)
    s.removeItem(OLD_GA_KEY)
    if (value === 'no') for (const k of COUNTING_KEYS) s.removeItem(k)
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSENT_CHANGED, { detail: value }))
}

/** Open the cookie settings again (the footer's "Cookie settings"). */
export function openCookieSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))
}
