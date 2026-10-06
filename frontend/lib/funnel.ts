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

import { gaEvent } from '@/lib/analytics'

// Bump when onboarding changes enough that its numbers should be compared
// separately (Riipen: "create a revised onboarding group"). riipen-2026-10 was
// the first revision (readability, info before sign-up); goalfirst-2026-10 the
// goal-first start of three steps; twostep-2026-10 the two-question start (who
// for, one goal) with norms optional and asked again later (Group 5).
export const ONBOARDING_VERSION = 'twostep-2026-10'

export type FunnelEvent =
  | 'landing_view'
  | 'signup_view'
  | 'signup_complete'
  | 'onboarding_step_view'
  | 'onboarding_complete'
  | 'app_open'
  // "Start here" (Riipen Labs, Group 4's measures): chose who for, reached a
  // pathway (completion), opened a resource, said whether it was useful
  // (relevance), saved the path (a next action). Steps carry the answers,
  // e.g. "child.services", never anything typed.
  | 'start_role'
  | 'start_pathway'
  | 'start_open'
  | 'start_useful'
  | 'start_save'
  // Which parts of the app people open (Riipen Labs, Group 5: track "which
  // features different user groups actually use"). Step: the area, below.
  // At most once a day per area per browser, signed in only.
  | 'feature_use'
  // Optional setup questions asked later on the Path (Riipen Labs, Group 7:
  // "assumption to test, not assume: users will actually engage ... later if
  // not asked upfront"). Step: "shown.<group>", "done.<question>" or
  // "closed.<group>" (lib/askLater.ts).
  | 'ask_later'

// Parts of the app, by address. ResourceHub is opened through /go/servicehub,
// so its destination decides between Tidbits and the rest of ResourceHub.
const AREAS: [RegExp, string][] = [
  [/^\/path(\/|$)/, 'path'],
  [/^\/races(\/|$)/, 'races'],
  [/^\/milestones(\/|$)/, 'milestones'],
  [/^\/calendar(\/|$)/, 'calendar'],
  [/^\/tasks(\/|$)/, 'tasks'],
  [/^\/pit-stop(\/|$)/, 'pit_stop'],
  [/^\/tools(\/|$)/, 'tools'],
  [/^\/reflection(\/|$)/, 'journal'],
  [/^\/assistant(\/|$)/, 'assistant'],
  [/^\/family(\/|$)/, 'family'],
  [/^\/ideal-self(\/|$)/, 'dream_self'],
  [/^\/(profile|settings)(\/|$)/, 'settings'],
  [/^\/start(\/|$)/, 'start'],
  [/^\/path-market(\/|$)/, 'path_market'],
  [/^\/paths\/compare(\/|$)/, 'compare'],
]
// Things done rather than places opened, sent the same way: the AI goal
// helper answered, and one of its suggestions was added (Riipen Labs, Group
// 11 suggested testing "the AI guide vs the standard Goals step"), and setup
// answered as a chat (components/ChatSetup).
export const ACTION_IDS = ['goal_helper', 'goal_helper_pick', 'setup_chat']
export const AREA_IDS = [...AREAS.map(([, id]) => id), 'tidbits', 'resourcehub', ...ACTION_IDS]

export function areaFor(pathname: string, search = ''): string | null {
  if (pathname === '/go/servicehub') {
    const next = new URLSearchParams(search).get('next') || '/'
    return next.startsWith('/community') ? 'tidbits' : 'resourcehub'
  }
  return AREAS.find(([pattern]) => pattern.test(pathname))?.[1] ?? null
}

const VISITOR_KEY = 'autinerary_visitor_id'
const AREA_DAYS_KEY = 'autinerary_area_days'
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
  // The same event to Google Analytics, only if it is on and allowed (lib/analytics.ts).
  gaEvent(event, step)
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

/** One "feature_use" per area per calendar day per browser. */
export function trackArea(pathname: string, search = ''): void {
  const area = areaFor(pathname, search)
  if (!area) return
  try {
    const today = new Date().toISOString().slice(0, 10)
    const days = JSON.parse(localStorage.getItem(AREA_DAYS_KEY) || '{}')
    if (days[area] === today) return
    days[area] = today
    localStorage.setItem(AREA_DAYS_KEY, JSON.stringify(days))
  } catch {
    return
  }
  track('feature_use', area)
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
