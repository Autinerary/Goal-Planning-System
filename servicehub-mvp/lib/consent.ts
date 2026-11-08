// Cookies and counting in ResourceHub, as in the Autinerary app (frontend/lib/consent.ts; the cookie policy covers
// both apps). Signing in and accessibility settings need no yes. Counting visits (lib/track.ts,
// components/layout/VisitTracker) waits for one: nothing is counted, and no visitor ID is made, until someone presses
// Allow. A browser sending Global Privacy Control or Do Not Track counts as a no, whatever was pressed.

export type Consent = 'yes' | 'no'

export const CONSENT_KEY = 'rh_cookie_consent'
/** What counting keeps in this browser, removed when someone says no. */
export const COUNTING_KEYS = ['rh_visitor_id', 'rh_visit_at', 'rh_visit_day', 'rh_first_resource_at']
export const CONSENT_CHANGED = 'rh:consent'
export const OPEN_COOKIE_SETTINGS = 'rh:cookie-settings'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Nav = { globalPrivacyControl?: boolean; doNotTrack?: string | null }

const store = (): Store | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function browserSaysNo(nav: Nav | null = typeof navigator === 'undefined' ? null : (navigator as Nav)): boolean {
  if (!nav) return true
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

export function countingConsent(s: Store | null = store()): Consent | null {
  if (!s) return null
  try {
    const v = s.getItem(CONSENT_KEY)
    return v === 'yes' || v === 'no' ? v : null
  } catch {
    return null
  }
}

export function countingAllowed(s: Store | null = store(), nav?: Nav | null): boolean {
  return !browserSaysNo(nav === undefined ? (typeof navigator === 'undefined' ? null : (navigator as Nav)) : nav) && countingConsent(s) === 'yes'
}

export function setCountingConsent(value: Consent, s: Store | null = store()): void {
  if (!s) return
  try {
    s.setItem(CONSENT_KEY, value)
    if (value === 'no') for (const k of COUNTING_KEYS) s.removeItem(k)
  } catch {}
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSENT_CHANGED, { detail: value }))
}

export function openCookieSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))
}
