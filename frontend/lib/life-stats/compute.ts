/**
 * Pure functions that turn raw activity rows into Life Stats values.
 *
 * Every score is a 0..100 integer over a 7-day rolling window. The UI
 * divides by 10 to render as "X/10". Storing as 0..100 keeps the integer
 * math clean while leaving room for finer-grained UI later.
 *
 * No DB calls in this file — the route handler fetches rows and calls
 * these. That keeps the math testable in isolation.
 */

// ---------- Types ----------

export type StatName = 'mentality' | 'happiness' | 'focus' | 'energy'

export interface ActivityPing {
  // Any timestamped user-write event in the last 7 days.
  // We dedupe by date to compute "active days".
  occurredAt: Date
}

export interface CalendarRow {
  day: Date               // calendar slot date
  completed: boolean
  completedAt: Date | null
}

export interface ReflectionRow {
  createdAt: Date
  // -1..+1 sentiment score. Null if backend didn't compute one.
  sentiment: number | null
}

export interface MilestoneEvent {
  completedAt: Date       // a row from race_progress where kind='completed'
}

export interface CheckinRow {
  checkinDate: Date
  mood: number            // 1..10
}

export interface SocialEvent {
  occurredAt: Date
  // 'connection_accepted' | 'suggestion_sent' | 'suggestion_accepted'
  // We don't actually branch on type in v1 — every event counts the same —
  // but keep the field so future weighting is easy.
  type: string
}

export interface StatComponents {
  // Human-readable breakdown shown in the "why is my Focus 5?" popover.
  // Each entry is { label, value, weight }. value is whatever number is
  // meaningful for that signal (a ratio, a count, etc.) — the popover
  // formats it.
  parts: { label: string; value: number; weight: number }[]
  // 0..100 raw score.
  score: number
}

// ---------- Helpers ----------

const MS_PER_DAY = 86_400_000

/** Inclusive day-key (YYYY-MM-DD) in UTC so dedup is stable across TZ. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Days between two dates, ignoring time of day. */
function daysAgo(d: Date, now: Date): number {
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY)
}

function clamp(n: number, lo = 0, hi = 100): number {
  if (Number.isNaN(n)) return lo
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function within7Days<T extends { occurredAt?: Date; completedAt?: Date | null; createdAt?: Date; checkinDate?: Date; day?: Date; scheduledDate?: Date }>(
  rows: T[],
  pick: (r: T) => Date | null | undefined,
  now: Date
): T[] {
  return rows.filter((r) => {
    const d = pick(r)
    if (!d) return false
    const age = daysAgo(d, now)
    return age >= 0 && age <= 6
  })
}

// ---------- FOCUS ----------
// 60% calendar items completed / scheduled (last 7d) — "did you do what you planned?"
// 40% milestones completed (last 7d, capped at 5) — "did you ALSO hit a bigger goal?"
// If a denominator is 0 we re-normalize so the other signal carries the score.

export function computeFocus(
  calendar: CalendarRow[],
  milestoneEvents: MilestoneEvent[],
  now: Date = new Date()
): StatComponents {
  const recentCal = within7Days(calendar, (c) => c.day, now)
  const calScheduled = recentCal.length
  const calDone = recentCal.filter((c) => c.completed).length
  const calRatio = calScheduled > 0 ? calDone / calScheduled : null

  const MILESTONE_CAP = 5
  const recentMilestones = within7Days(milestoneEvents, (m) => m.completedAt, now)
  const milestoneCount = Math.min(recentMilestones.length, MILESTONE_CAP)
  const milestoneRatio = milestoneCount / MILESTONE_CAP

  let score = 0
  let totalWeight = 0
  if (calRatio !== null) { score += calRatio * 0.6; totalWeight += 0.6 }
  // Milestones always contribute — 0 milestones is a valid signal (low score).
  score += milestoneRatio * 0.4
  totalWeight += 0.4

  const final = totalWeight > 0 ? (score / totalWeight) * 100 : 0

  return {
    score: clamp(final),
    parts: [
      {
        label: calScheduled > 0
          ? `${calDone}/${calScheduled} planned items done this week`
          : 'No items scheduled this week',
        value: calRatio ?? 0,
        weight: 0.6,
      },
      { label: `${recentMilestones.length} milestones completed this week`, value: milestoneRatio, weight: 0.4 },
    ],
  }
}

// ---------- ENERGY ----------
// 60% active days in last 7
// 40% streak length (consecutive active days ending today, capped at 14)

export function computeEnergy(pings: ActivityPing[], now: Date = new Date()): StatComponents {
  const todayKey = dayKey(now)

  // Days the user did *something* in the last 7 calendar days, dedup'd.
  const activeDays = new Set<string>()
  for (const p of pings) {
    const age = daysAgo(p.occurredAt, now)
    if (age >= 0 && age <= 6) activeDays.add(dayKey(p.occurredAt))
  }
  const activeCount = activeDays.size
  const activeRatio = activeCount / 7

  // Streak: walk backward from today, count consecutive active days.
  // Cap at 14 so a user with a 60-day streak doesn't max it forever.
  const STREAK_CAP = 14
  const allActiveDayKeys = new Set<string>()
  for (const p of pings) {
    if (daysAgo(p.occurredAt, now) >= 0) allActiveDayKeys.add(dayKey(p.occurredAt))
  }
  let streak = 0
  // If today isn't active, the streak is broken at 0 — be honest.
  if (allActiveDayKeys.has(todayKey)) {
    for (let i = 0; i < STREAK_CAP; i++) {
      const d = new Date(now.getTime() - i * MS_PER_DAY)
      if (allActiveDayKeys.has(dayKey(d))) streak++
      else break
    }
  }
  const streakRatio = streak / STREAK_CAP

  const final = (activeRatio * 0.6 + streakRatio * 0.4) * 100
  return {
    score: clamp(final),
    parts: [
      { label: `${activeCount}/7 active days this week`, value: activeRatio, weight: 0.6 },
      { label: `${streak}-day streak`, value: streakRatio, weight: 0.4 },
    ],
  }
}

// ---------- MENTALITY ----------
// 50% avg reflection sentiment (last 7d, normalized -1..1 → 0..1)
// 30% milestones completed in last 7d (capped at 5)
// 20% barrier-load penalty: starts at 1.0, subtracts 0.05 per barrier (floor 0.5)
//     This is small so it nudges the baseline without being demoralising.

export function computeMentality(
  reflections: ReflectionRow[],
  milestoneEvents: MilestoneEvent[],
  barrierCount: number,
  now: Date = new Date()
): StatComponents {
  const recentReflections = within7Days(reflections, (r) => r.createdAt, now)
    .filter((r) => r.sentiment !== null) as Required<ReflectionRow>[]
  const sentimentAvg = recentReflections.length > 0
    ? recentReflections.reduce((s, r) => s + (r.sentiment as number), 0) / recentReflections.length
    : null
  const sentimentRatio = sentimentAvg === null ? null : (sentimentAvg + 1) / 2

  const MILESTONE_CAP = 5
  const recentMilestones = within7Days(milestoneEvents, (m) => m.completedAt, now)
  const milestoneCount = Math.min(recentMilestones.length, MILESTONE_CAP)
  const milestoneRatio = milestoneCount / MILESTONE_CAP

  const barrierMultiplier = Math.max(0.5, 1 - 0.05 * barrierCount)

  let score = 0
  let totalWeight = 0
  if (sentimentRatio !== null) { score += sentimentRatio * 0.5; totalWeight += 0.5 }
  score += milestoneRatio * 0.3; totalWeight += 0.3
  // Barrier penalty applies as a multiplier on the (renormalized) score below.

  const baseFinal = totalWeight > 0 ? (score / totalWeight) : 0
  const final = baseFinal * barrierMultiplier * 100

  return {
    score: clamp(final),
    parts: [
      {
        label: recentReflections.length > 0
          ? `Avg reflection sentiment over ${recentReflections.length} entries`
          : 'No reflections this week',
        value: sentimentRatio ?? 0,
        weight: 0.5,
      },
      { label: `${recentMilestones.length} milestones completed this week`, value: milestoneRatio, weight: 0.3 },
      { label: `${barrierCount} known barriers (small penalty)`, value: barrierMultiplier, weight: 0.2 },
    ],
  }
}

// ---------- HAPPINESS (hybrid: check-in if available, inferred otherwise) ----------

export interface HappinessResult extends StatComponents {
  source: 'checkin' | 'inferred'
}

export function computeHappiness(
  checkins: CheckinRow[],
  reflections: ReflectionRow[],
  socialEvents: SocialEvent[],
  now: Date = new Date()
): HappinessResult {
  const recentCheckins = within7Days(checkins, (c) => c.checkinDate, now)
  if (recentCheckins.length > 0) {
    // Mood is 1..10 → normalize to 0..1.
    const moodAvg = recentCheckins.reduce((s, c) => s + c.mood, 0) / recentCheckins.length
    const moodRatio = (moodAvg - 1) / 9
    return {
      source: 'checkin',
      score: clamp(moodRatio * 100),
      parts: [
        { label: `Avg mood over ${recentCheckins.length} check-ins`, value: moodRatio, weight: 1.0 },
      ],
    }
  }

  // Inferred fallback when the user hasn't checked in this week:
  // 70% reflection sentiment, 30% social engagement.
  const recentReflections = within7Days(reflections, (r) => r.createdAt, now)
    .filter((r) => r.sentiment !== null) as Required<ReflectionRow>[]
  const sentimentAvg = recentReflections.length > 0
    ? recentReflections.reduce((s, r) => s + (r.sentiment as number), 0) / recentReflections.length
    : null
  const sentimentRatio = sentimentAvg === null ? null : (sentimentAvg + 1) / 2

  const SOCIAL_CAP = 5
  const recentSocial = within7Days(socialEvents, (s) => s.occurredAt, now)
  const socialRatio = Math.min(recentSocial.length, SOCIAL_CAP) / SOCIAL_CAP

  let score = 0
  let totalWeight = 0
  if (sentimentRatio !== null) { score += sentimentRatio * 0.7; totalWeight += 0.7 }
  score += socialRatio * 0.3; totalWeight += 0.3

  const final = totalWeight > 0 ? (score / totalWeight) * 100 : 0

  return {
    source: 'inferred',
    score: clamp(final),
    parts: [
      {
        label: recentReflections.length > 0
          ? `Reflection sentiment (${recentReflections.length} entries)`
          : 'No reflections — tap "How are you today?" to log a mood',
        value: sentimentRatio ?? 0,
        weight: 0.7,
      },
      { label: `${recentSocial.length} social interactions this week`, value: socialRatio, weight: 0.3 },
    ],
  }
}
