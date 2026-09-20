/**
 * Patterns actually derived from a person's journal entries.
 *
 * This replaces four hardcoded sentences that the history page rendered for
 * everybody the moment they had a single entry:
 *
 *   "Morning routines correlate with higher productivity ratings"
 *   "Extended social interactions often lead to next-day fatigue"
 *   "Schedule recovery time after collaborative sessions"
 *   "Connecting with peers who understand the barriers you face boosts motivation"
 *
 * None of them looked at the entries. A tester pointed out that theirs said
 * the opposite of what had happened: their extended-social day was the bad
 * one and the day after was good. Confident text that contradicts what
 * someone just wrote down is worse than no text at all, particularly in a
 * tool people are using to understand themselves.
 *
 * Every detector below states the count it is drawn from, and refuses to
 * speak when the sample is too small. With a handful of entries the correct
 * output is "not enough yet", which is what the tester should have seen.
 */

export type PatternKind = 'positive' | 'warning' | 'recommendation' | 'success'

export interface DetectedPattern {
  kind: PatternKind
  /** The claim. */
  text: string
  /** What the claim is counted from, shown to the reader. */
  basis: string
}

export interface PatternInput {
  date: string
  contextType: string
  contextName?: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

/**
 * Below this we say nothing at all. Three entries cannot support a claim
 * about someone's life, and dressing one up as a "detected pattern" is how
 * the old version went wrong.
 */
export const MIN_ENTRIES_FOR_PATTERNS = 6

/** A context needs this many entries before it is compared with others. */
const MIN_PER_CONTEXT = 3

/** Consecutive-day transitions needed before a knock-on claim is made. */
const MIN_TRANSITIONS = 4

const CONTEXT_LABELS: Record<string, string> = {
  path: 'your path',
  milestone: 'milestones',
  task: 'tasks',
  calendar: 'calendar days',
  race: 'goals',
}

function contextLabel(type: string): string {
  return CONTEXT_LABELS[type] || type
}

function dayNumber(date: string): number | null {
  const t = new Date(date).getTime()
  return Number.isNaN(t) ? null : Math.floor(t / 86_400_000)
}

/**
 * Which contexts go well and which go badly.
 *
 * Only contexts with enough entries of their own are compared, and only a
 * clear majority counts. A 50/50 split is not a pattern.
 */
function contextPatterns(entries: PatternInput[]): DetectedPattern[] {
  const byContext = new Map<string, PatternInput[]>()
  for (const e of entries) {
    const list = byContext.get(e.contextType) || []
    list.push(e)
    byContext.set(e.contextType, list)
  }

  const out: DetectedPattern[] = []
  let bestPositive: { type: string; ratio: number; n: number } | null = null
  let worstNegative: { type: string; ratio: number; n: number } | null = null

  for (const [type, list] of byContext) {
    if (list.length < MIN_PER_CONTEXT) continue
    const pos = list.filter((e) => e.sentiment === 'positive').length / list.length
    const neg = list.filter((e) => e.sentiment === 'negative').length / list.length
    // A clear majority, and clearly more than the other direction. An even
    // 50/50 split was previously reported as "more often difficult than
    // not", which is simply not what an even split means.
    if (pos >= 0.6 && pos > neg && (!bestPositive || pos > bestPositive.ratio)) {
      bestPositive = { type, ratio: pos, n: list.length }
    }
    if (neg >= 0.6 && neg > pos && (!worstNegative || neg > worstNegative.ratio)) {
      worstNegative = { type, ratio: neg, n: list.length }
    }
  }

  if (bestPositive) {
    out.push({
      kind: 'positive',
      text: `Your entries about ${contextLabel(bestPositive.type)} are usually positive.`,
      basis: `${Math.round(bestPositive.ratio * 100)}% of ${bestPositive.n} entries`,
    })
  }
  if (worstNegative) {
    out.push({
      kind: 'warning',
      text: `Your entries about ${contextLabel(worstNegative.type)} are more often difficult than not.`,
      basis: `${Math.round(worstNegative.ratio * 100)}% of ${worstNegative.n} entries`,
    })
    out.push({
      kind: 'recommendation',
      text: `It may be worth giving ${contextLabel(worstNegative.type)} more room, or breaking them into smaller steps.`,
      basis: `based on the ${worstNegative.n} entries above`,
    })
  }
  return out
}

/**
 * Does a hard day tend to follow a particular kind of day?
 *
 * This is the claim the hardcoded "next-day fatigue" line was imitating. It
 * is only made when enough consecutive-day pairs exist to support it.
 */
function knockOnPattern(entries: PatternInput[]): DetectedPattern[] {
  const byDay = new Map<number, PatternInput>()
  for (const e of entries) {
    const d = dayNumber(e.date)
    if (d !== null && !byDay.has(d)) byDay.set(d, e)
  }

  const followedBy = new Map<string, { hard: number; total: number }>()
  for (const [day, entry] of byDay) {
    const next = byDay.get(day + 1)
    if (!next) continue
    const rec = followedBy.get(entry.contextType) || { hard: 0, total: 0 }
    rec.total += 1
    if (next.sentiment === 'negative') rec.hard += 1
    followedBy.set(entry.contextType, rec)
  }

  for (const [type, rec] of followedBy) {
    if (rec.total < MIN_TRANSITIONS) continue
    const ratio = rec.hard / rec.total
    if (ratio >= 0.6) {
      return [{
        kind: 'warning',
        text: `A day about ${contextLabel(type)} is often followed by a harder day.`,
        basis: `${rec.hard} of ${rec.total} times`,
      }]
    }
  }
  return []
}

/** Is the recent stretch going better or worse than the earlier one? */
function trendPattern(entries: PatternInput[]): DetectedPattern[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  const half = Math.floor(sorted.length / 2)
  if (half < 3) return []

  const score = (list: PatternInput[]) =>
    list.reduce((s, e) => s + (e.sentiment === 'positive' ? 1 : e.sentiment === 'negative' ? -1 : 0), 0) /
    list.length

  const earlier = score(sorted.slice(0, half))
  const recent = score(sorted.slice(sorted.length - half))
  const delta = recent - earlier

  // A third of a point on a -1..1 scale, so small drift stays quiet.
  if (delta >= 0.34) {
    return [{
      kind: 'success',
      text: 'Your recent entries read more positively than your earlier ones.',
      basis: `comparing your last ${half} entries with your first ${half}`,
    }]
  }
  if (delta <= -0.34) {
    return [{
      kind: 'warning',
      text: 'Your recent entries read harder than your earlier ones.',
      basis: `comparing your last ${half} entries with your first ${half}`,
    }]
  }
  return []
}

/**
 * All patterns we can honestly support from these entries.
 * An empty array means we have nothing to say, and the caller must say so
 * rather than filling the space.
 */
export function detectPatterns(entries: PatternInput[]): DetectedPattern[] {
  const usable = entries.filter((e) => e.date && e.sentiment)
  if (usable.length < MIN_ENTRIES_FOR_PATTERNS) return []
  return [
    ...contextPatterns(usable),
    ...knockOnPattern(usable),
    ...trendPattern(usable),
  ]
}
