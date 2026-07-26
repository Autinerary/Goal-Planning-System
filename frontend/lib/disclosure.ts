// Progressive disclosure
//
// The app starts SIMPLE and reveals more as the user returns, so new users
// aren't overwhelmed (Eliyana's feedback: "start out simple… then progresses as
// you spend more time"). This is a separate axis from view "energy" in
// preferences.ts (how much visual flair) — disclosure controls how many
// FEATURES are surfaced.
//
// Level is derived from the number of distinct days the user has opened the app,
// unless they've set an explicit override (a "Show more" / "Keep it simple"
// control). Everything is client-side/localStorage, mirroring preferences.ts.
'use client'

import { useEffect, useState } from 'react'

export type DisclosureLevel = 'simple' | 'standard' | 'full'

const VISITS_KEY = 'autinerary_visit_days'
const OVERRIDE_KEY = 'autinerary_disclosure_override'
/** Broadcast on the same tab when the level changes (storage only fires cross-tab). */
export const DISCLOSURE_EVENT = 'autinerary:disclosure'

/** Distinct-day thresholds. Start simple; open up as the habit forms. */
const STANDARD_AFTER_DAYS = 2
const FULL_AFTER_DAYS = 5
/** Keep the stored visit history bounded. */
const MAX_VISIT_DAYS = 60

const LEVEL_RANK: Record<DisclosureLevel, number> = { simple: 0, standard: 1, full: 2 }

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function readVisitDays(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(VISITS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Record today as a visit day (deduped). Safe to call on every app load. */
export function recordVisit(): void {
  if (typeof window === 'undefined') return
  try {
    const today = dayKey(new Date())
    const days = readVisitDays()
    if (days.includes(today)) return
    const next = [...days, today].slice(-MAX_VISIT_DAYS)
    localStorage.setItem(VISITS_KEY, JSON.stringify(next))
    // A new distinct day may cross a threshold — let listeners re-read.
    window.dispatchEvent(new CustomEvent(DISCLOSURE_EVENT))
  } catch {
    /* quota — ignore */
  }
}

export function getVisitDayCount(): number {
  return readVisitDays().length
}

function getOverride(): DisclosureLevel | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(OVERRIDE_KEY)
    return v === 'simple' || v === 'standard' || v === 'full' ? v : null
  } catch {
    return null
  }
}

/**
 * Set (or clear, with null) the manual disclosure override. Broadcasts so the
 * whole app updates instantly.
 */
export function setDisclosureOverride(level: DisclosureLevel | null): void {
  if (typeof window === 'undefined') return
  try {
    if (level) localStorage.setItem(OVERRIDE_KEY, level)
    else localStorage.removeItem(OVERRIDE_KEY)
    window.dispatchEvent(new CustomEvent(DISCLOSURE_EVENT))
  } catch {
    /* ignore */
  }
}

/** The usage-derived level, ignoring any override. */
export function getUsageLevel(): DisclosureLevel {
  const days = getVisitDayCount()
  if (days >= FULL_AFTER_DAYS) return 'full'
  if (days >= STANDARD_AFTER_DAYS) return 'standard'
  return 'simple'
}

/** Effective disclosure level: manual override wins, else usage-derived. */
export function getDisclosureLevel(): DisclosureLevel {
  return getOverride() ?? getUsageLevel()
}

/** True when the app should show its simplest surface. */
export function isSimpleView(): boolean {
  return getDisclosureLevel() === 'simple'
}

/** Is `level` at least `min`? (e.g. gate a feature at 'standard'.) */
export function atLeast(level: DisclosureLevel, min: DisclosureLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[min]
}

/**
 * Live disclosure level for components. Re-reads on the same-tab
 * `autinerary:disclosure` event and cross-tab storage changes. Returns the
 * level plus helpers and an override setter.
 */
export function useDisclosure() {
  const [level, setLevel] = useState<DisclosureLevel>('simple')

  useEffect(() => {
    const sync = () => setLevel(getDisclosureLevel())
    sync()
    window.addEventListener(DISCLOSURE_EVENT, sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(DISCLOSURE_EVENT, sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return {
    level,
    isSimple: level === 'simple',
    atLeast: (min: DisclosureLevel) => atLeast(level, min),
    setOverride: setDisclosureOverride,
  }
}
