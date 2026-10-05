import { SETUP_VERSION } from '@/lib/onboarding/setup'

/**
 * ResourceHub's first-session events (app/api/events). Fire and forget: a
 * failed send never shows or blocks anything. Browsers that send Do Not
 * Track or Global Privacy Control send nothing, as in Goal Planning
 * (frontend/lib/funnel.ts).
 */

export type TrackEvent =
  | 'rh_visit'
  | 'rh_setup_step'
  | 'rh_setup_complete'
  | 'rh_first_resource'
  | 'rh_search'
  | 'rh_prompt'

/** The prompts that ask for more after setup (Riipen Labs, Group 8). */
export const PROMPT_IDS = ['sharpen', 'more_like_these', 'add_topic'] as const
export type PromptId = (typeof PROMPT_IDS)[number]

const VISITOR_KEY = 'rh_visitor_id'

function optedOut(): boolean {
  if (typeof navigator === 'undefined') return true
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  return nav.globalPrivacyControl === true || nav.doNotTrack === '1'
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = newId()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function track(event: TrackEvent, step?: string): void {
  if (typeof window === 'undefined' || optedOut()) return
  const id = visitorId()
  if (!id) return
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, step, visitorId: id, version: SETUP_VERSION }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}

/** Once per browser: true the first time it is asked for this key. */
export function firstTime(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return false
    localStorage.setItem(key, new Date().toISOString())
    return true
  } catch {
    return false
  }
}
