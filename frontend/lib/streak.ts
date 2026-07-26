// Daily streaks (with freezes + celebration milestones)
//
// Tracks consecutive days the user COMPLETES A TASK and exposes current/longest
// streak, available freezes, and pending celebrations for a visible streak
// experience (Eliyana: "Streaks!" + depth). Client-side/localStorage, consistent
// with preferences.ts and disclosure.ts.
//
// "Active" = completed a task that day. Call recordActiveDay() from the task
// completion handler (see app/tasks/[id]/page.tsx). A "freeze" auto-bridges a
// missed day so a single slip doesn't reset a hard-won streak — you earn one
// freeze per 7-day milestone (capped).
'use client'

import { useEffect, useState } from 'react'

const ACTIVE_KEY = 'autinerary_active_days'
const FREEZE_KEY = 'autinerary_freeze_days'
const META_KEY = 'autinerary_streak_meta'
const MAX_DAYS = 400
/** Broadcast on the same tab when activity changes (storage only fires cross-tab). */
export const STREAK_EVENT = 'autinerary:streak'

const START_FREEZES = 2
const MAX_FREEZES = 5
/** Streak lengths worth celebrating. */
export const CELEBRATION_MILESTONES = [3, 7, 14, 30, 60, 100]

export interface StreakInfo {
  /** Consecutive active (or frozen) days ending today, or yesterday as a grace. */
  current: number
  /** Best run ever recorded. */
  longest: number
  /** Whether today is already counted. */
  activeToday: boolean
  /** Freezes available to auto-bridge a missed day. */
  freezesAvailable: number
}

interface StreakMeta {
  freezesAvailable: number
  /** Highest streak we've already granted freezes for (avoids double-award). */
  lastAwardStreak: number
  /** Highest milestone already celebrated (avoids re-firing). */
  lastCelebrated: number
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function parseDay(key: string): Date {
  return new Date(key + 'T00:00:00')
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}

function daysBetween(aKey: string, bKey: string): number {
  return Math.round((parseDay(bKey).getTime() - parseDay(aKey).getTime()) / 86400000)
}

function readDays(key: string): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeDays(key: string, days: Set<string>): void {
  try {
    const sorted = Array.from(days).sort().slice(-MAX_DAYS)
    localStorage.setItem(key, JSON.stringify(sorted))
  } catch {
    /* quota — ignore */
  }
}

function readMeta(): StreakMeta {
  const base: StreakMeta = { freezesAvailable: START_FREEZES, lastAwardStreak: 0, lastCelebrated: 0 }
  if (typeof window === 'undefined') return base
  try {
    const raw = localStorage.getItem(META_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    return {
      freezesAvailable: typeof parsed.freezesAvailable === 'number' ? parsed.freezesAvailable : START_FREEZES,
      lastAwardStreak: typeof parsed.lastAwardStreak === 'number' ? parsed.lastAwardStreak : 0,
      lastCelebrated: typeof parsed.lastCelebrated === 'number' ? parsed.lastCelebrated : 0,
    }
  } catch {
    return base
  }
}

function writeMeta(meta: StreakMeta): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

function lastDayBefore(days: Set<string>, todayKey: string): string | null {
  let latest: string | null = null
  for (const d of days) {
    if (d < todayKey && (latest === null || d > latest)) latest = d
  }
  return latest
}

/** Core: consecutive-run computation over the union of active + frozen days. */
function computeStreak(active: Set<string>, freeze: Set<string>): { current: number; longest: number; activeToday: boolean } {
  const days = new Set<string>([...active, ...freeze])
  const today = new Date()
  const todayKey = dayKey(today)
  const activeToday = active.has(todayKey)

  // Current: walk back from today; 1-day grace if today isn't done yet.
  let cursor = days.has(todayKey) ? today : addDays(today, -1)
  let current = 0
  while (days.has(dayKey(cursor))) {
    current++
    cursor = addDays(cursor, -1)
  }

  // Longest: scan for the longest consecutive run.
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const key of Array.from(days).sort()) {
    run = prev && daysBetween(prev, key) === 1 ? run + 1 : 1
    if (run > longest) longest = run
    prev = key
  }

  return { current, longest: Math.max(longest, current), activeToday }
}

/**
 * Record today as an active day (task completed). Idempotent per day. Bridges a
 * fully-coverable gap with freezes and awards freezes at 7-day milestones.
 */
export function recordActiveDay(): void {
  if (typeof window === 'undefined') return
  try {
    const today = dayKey(new Date())
    const active = readDays(ACTIVE_KEY)
    if (active.has(today)) return

    const freeze = readDays(FREEZE_KEY)
    const meta = readMeta()

    // Bridge a gap only if we can cover ALL missed days (a partial bridge would
    // still break the streak and waste freezes).
    const recorded = new Set<string>([...active, ...freeze])
    const last = lastDayBefore(recorded, today)
    if (last) {
      const missed = daysBetween(last, today) - 1
      if (missed > 0 && meta.freezesAvailable >= missed) {
        for (let i = 1; i <= missed; i++) freeze.add(dayKey(addDays(parseDay(last), i)))
        meta.freezesAvailable -= missed
      }
    }

    active.add(today)
    writeDays(ACTIVE_KEY, active)
    writeDays(FREEZE_KEY, freeze)

    // Award a freeze for each newly-crossed 7-day milestone (capped).
    const { current } = computeStreak(active, freeze)
    const earned = Math.floor(current / 7) - Math.floor(meta.lastAwardStreak / 7)
    if (earned > 0) meta.freezesAvailable = Math.min(MAX_FREEZES, meta.freezesAvailable + earned)
    meta.lastAwardStreak = Math.max(meta.lastAwardStreak, current)
    writeMeta(meta)

    window.dispatchEvent(new CustomEvent(STREAK_EVENT))
  } catch {
    /* quota — ignore */
  }
}

/** Compute current + longest streak and available freezes. */
export function getStreak(): StreakInfo {
  const { current, longest, activeToday } = computeStreak(readDays(ACTIVE_KEY), readDays(FREEZE_KEY))
  return { current, longest, activeToday, freezesAvailable: readMeta().freezesAvailable }
}

/** The highest not-yet-celebrated milestone the current streak has reached, or null. */
export function getPendingCelebration(): number | null {
  const { current } = getStreak()
  const last = readMeta().lastCelebrated
  let pending: number | null = null
  for (const m of CELEBRATION_MILESTONES) {
    if (current >= m && m > last) pending = m
  }
  return pending
}

/** Mark a milestone as celebrated so it doesn't fire again. */
export function markCelebrated(n: number): void {
  const meta = readMeta()
  if (n > meta.lastCelebrated) {
    meta.lastCelebrated = n
    writeMeta(meta)
    window.dispatchEvent(new CustomEvent(STREAK_EVENT))
  }
}

/**
 * Per-weekday activity from recorded active days — powers the "typical pattern
 * & best day" insight (Odosa's memory feature). counts[0]=Sunday…counts[6]=Sat.
 */
export function getWeekdayStats(): { counts: number[]; bestDayIndex: number | null; totalActive: number } {
  const active = readDays(ACTIVE_KEY)
  const counts = [0, 0, 0, 0, 0, 0, 0]
  active.forEach((key) => {
    counts[parseDay(key).getDay()]++
  })
  let bestDayIndex: number | null = null
  let max = 0
  counts.forEach((c, i) => {
    if (c > max) {
      max = c
      bestDayIndex = i
    }
  })
  return { counts, bestDayIndex: active.size > 0 ? bestDayIndex : null, totalActive: active.size }
}

/** Live streak for components. */
export function useStreak(): StreakInfo {
  const [info, setInfo] = useState<StreakInfo>({ current: 0, longest: 0, activeToday: false, freezesAvailable: START_FREEZES })

  useEffect(() => {
    const sync = () => setInfo(getStreak())
    sync()
    window.addEventListener(STREAK_EVENT, sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(STREAK_EVENT, sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return info
}
