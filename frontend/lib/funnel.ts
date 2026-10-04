/**
 * Onboarding funnel events (see backend/database/migrations/2026_onboarding_funnel.sql).
 *
 * Riipen Labs' review asked for "analytics to track where users enter and
 * leave the onboarding process" and three success measures: the share of
 * visitors who complete account creation, users who return within 7 days,
 * and users who leave during onboarding. These events are what
 * backend/scripts/onboarding_funnel.py turns into those numbers.
 *
 * What is sent: the event name, an onboarding step id, the first visit's
 * utm_source / utm_campaign and referring site's host name, and a random
 * visitor id kept in this browser. Nothing a person types, no full URLs.
 * Browsers that send Do Not Track or Global Privacy Control send nothing.
 * Every call is fire-and-forget: a failed or blocked request never affects
 * the page.
 */

// Bump when onboarding changes enough that its numbers should be compared
// separately (Riipen: "create a revised onboarding group"). riipen-2026-10 was
// the first revision (readability, info before sign-up); goalfirst-2026-10 is
// the goal-first, three-step start.
export const ONBOARDING_VERSION = 'goalfirst-2026-10'

export type FunnelEvent =
  | 'landing_view'
  | 'signup_view'
  | 'signup_complete'
  | 'onboarding_step_view'
  | 'onboarding_complete'
  | 'app_open'

const VISITOR_KEY = 'autinerary_visitor_id'
const FIRST_TOUCH_KEY = 'autinerary_first_touch'
const DAILY_OPEN_KEY = 'autinerary_last_open_day'

function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

interface FirstTouch {
  channel: string | null
  campaign: string | null
  referrerHost: string | null
}

/** Where this browser first arrived from, captured once and kept. */
function firstTouch(): FirstTouch {
  try {
    const saved = localStorage.getItem(FIRST_TOUCH_KEY)
    if (saved) return JSON.parse(saved)
    const params = new URLSearchParams(window.location.search)
    let referrerHost: string | null = null
    try {
      const host = document.referrer ? new URL(document.referrer).hostname : ''
      referrerHost = host && host !== window.location.hostname ? host : null
    } catch {}
    const touch: FirstTouch = {
      channel: (params.get('utm_source') || '').trim().toLowerCase().slice(0, 40) || null,
      campaign: (params.get('utm_campaign') || '').trim().slice(0, 80) || null,
      referrerHost: referrerHost ? referrerHost.slice(0, 120) : null,
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch))
    return touch
  } catch {
    return { channel: null, campaign: null, referrerHost: null }
  }
}

export function track(event: FunnelEvent, step?: string): void {
  if (typeof window === 'undefined' || optedOut()) return
  const id = visitorId()
  if (!id) return
  const touch = firstTouch()
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive lets the request finish if the page navigates straight
      // after (e.g. "signup_complete" followed by a redirect).
      keepalive: true,
      body: JSON.stringify({ visitorId: id, event, step: step ?? null, ...touch, version: ONBOARDING_VERSION }),
    }).catch(() => {})
  } catch {}
}

/** One "app_open" per calendar day per browser, for the 7-day return measure. */
export function trackDailyOpen(): void {
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(DAILY_OPEN_KEY) === today) return
    localStorage.setItem(DAILY_OPEN_KEY, today)
  } catch {
    return
  }
  track('app_open')
}
