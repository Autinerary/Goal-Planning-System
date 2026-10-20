/**
 * The Calendar's Analysis (Odosa, October 2026: "an 'Analysis' tab. When
 * clicked, you get the option to show your daily, weekly & monthly patterns,
 * as well as your best day(s)"; July: "Typical Pattern & Best Day, to know
 * what to aim for").
 *
 * From things done and when: plan tasks ticked (their hour is kept from 20
 * October 2026, lib/planTaskDone.ts), your own tasks done (their completion
 * time) and milestones finished. Weekdays are averaged over how many of each
 * there have been, so one busy Tuesday doesn't make every Tuesday look best.
 * Plain data and pure functions (lib/patterns.test.mjs).
 */

export type DoneKind = 'plan' | 'own' | 'milestone'

export interface DoneBucket {
  /** Local date, YYYY-MM-DD. */
  date: string
  hour: number
  count: number
  kind: DoneKind
}

/** Below this many things done, patterns would be guesses: Analysis says so. */
export const ENOUGH = 5

export const WEEK: { name: string; short: string }[] = [
  { name: 'Monday', short: 'Mon' },
  { name: 'Tuesday', short: 'Tue' },
  { name: 'Wednesday', short: 'Wed' },
  { name: 'Thursday', short: 'Thu' },
  { name: 'Friday', short: 'Fri' },
  { name: 'Saturday', short: 'Sat' },
  { name: 'Sunday', short: 'Sun' },
]

export const PARTS: { id: string; label: string; hours: string; test: (h: number) => boolean }[] = [
  { id: 'early', label: 'Early morning', hours: '5 to 9 am', test: (h) => h >= 5 && h < 9 },
  { id: 'morning', label: 'Morning', hours: '9 am to noon', test: (h) => h >= 9 && h < 12 },
  { id: 'afternoon', label: 'Afternoon', hours: 'noon to 5 pm', test: (h) => h >= 12 && h < 17 },
  { id: 'evening', label: 'Evening', hours: '5 to 9 pm', test: (h) => h >= 17 && h < 21 },
  { id: 'night', label: 'Night', hours: '9 pm to 5 am', test: (h) => h >= 21 || h < 5 },
]

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (date: string) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d) }
/** Monday 0 … Sunday 6. */
const weekdayIndex = (date: string) => (parse(date).getDay() + 6) % 7

/** Everything done, as dated hours: plan ticks, your own tasks and milestones. */
export function bucketsFrom({ doneHours, ownDone = [], milestonesDone = [] }: {
  doneHours?: Record<string, Record<string, number>>
  ownDone?: Date[]
  milestonesDone?: Date[]
}): DoneBucket[] {
  const out: DoneBucket[] = []
  for (const [date, hours] of Object.entries(doneHours || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hours) continue
    for (const [hour, n] of Object.entries(hours)) {
      const count = Number(n)
      const h = Number(hour)
      if (count > 0 && h >= 0 && h < 24) out.push({ date, hour: h, count, kind: 'plan' })
    }
  }
  const add = (d: Date, kind: DoneKind) => { if (!isNaN(d.getTime())) out.push({ date: dayKey(d), hour: d.getHours(), count: 1, kind }) }
  ownDone.forEach((d) => add(d, 'own'))
  milestonesDone.forEach((d) => add(d, 'milestone'))
  return out
}

export const total = (b: DoneBucket[]) => b.reduce((n, x) => n + x.count, 0)

/** The days with the most (all of them, when tied). */
function top<T>(items: T[], value: (t: T) => number): T[] {
  const max = Math.max(0, ...items.map(value))
  return max > 0 ? items.filter((t) => value(t) === max) : []
}

/** When in the day things get done: by part of the day, and by hour. */
export function dailyPattern(b: DoneBucket[]) {
  const hours = Array.from({ length: 24 }, () => 0)
  b.forEach((x) => { hours[x.hour] += x.count })
  const parts = PARTS.map((p) => ({ id: p.id, label: p.label, hours: p.hours, count: hours.reduce((n, c, h) => (p.test(h) ? n + c : n), 0) }))
  const peak = top(hours.map((count, hour) => ({ hour, count })), (h) => h.count)
  return { parts, hours, bestParts: top(parts, (p) => p.count).map((p) => p.label), peakHour: peak.length ? peak[0].hour : null }
}

/** How many of each weekday there have been from `first` to `today` (at least one). */
function weekdaysBetween(first: string, today: Date): number[] {
  const n = Array.from({ length: 7 }, () => 0)
  const d = parse(first)
  const end = parse(dayKey(today))
  if (d > end) return n.map(() => 1)
  for (let i = 0; d <= end && i < 400; i++) {
    n[(d.getDay() + 6) % 7]++
    d.setDate(d.getDate() + 1)
  }
  return n.map((c) => Math.max(1, c))
}

/** Which weekdays: things done on each, and on an average week. */
export function weeklyPattern(b: DoneBucket[], today: Date = new Date()) {
  const counts = Array.from({ length: 7 }, () => 0)
  b.forEach((x) => { counts[weekdayIndex(x.date)] += x.count })
  const first = b.length ? b.map((x) => x.date).sort()[0] : dayKey(today)
  const seen = weekdaysBetween(first, today)
  const days = WEEK.map((w, i) => ({ weekday: w.name, short: w.short, count: counts[i], perWeek: Math.round((counts[i] / seen[i]) * 10) / 10 }))
  return { days, best: top(days, (d) => d.perWeek).map((d) => d.weekday) }
}

const WEEK_OF_MONTH = ['1st to 7th', '8th to 14th', '15th to 21st', '22nd to 28th', '29th to 31st']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Through the month (by its weeks), and the last six months. */
export function monthlyPattern(b: DoneBucket[], today: Date = new Date()) {
  const weeks = WEEK_OF_MONTH.map((label) => ({ label, count: 0 }))
  b.forEach((x) => { weeks[Math.min(4, Math.floor((parse(x.date).getDate() - 1) / 7))].count += x.count })
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, count: b.filter((x) => x.date.startsWith(key)).reduce((n, x) => n + x.count, 0) }
  })
  return { weeks, months, bestWeeks: top(weeks, (w) => w.count).map((w) => w.label) }
}

/** The best days: weekdays, part of the day, the best date so far, and recent days with something done. */
export function bestDays(b: DoneBucket[], today: Date = new Date()) {
  const byDate = new Map<string, number>()
  b.forEach((x) => byDate.set(x.date, (byDate.get(x.date) || 0) + x.count))
  const best = top([...byDate.entries()].map(([date, count]) => ({ date, count })), (d) => d.count).sort((x, y) => (x.date < y.date ? 1 : -1))[0] || null
  const since = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29))
  const activeDays30 = [...byDate.keys()].filter((d) => d >= since && d <= dayKey(today)).length
  return {
    weekdays: weeklyPattern(b, today).best,
    parts: dailyPattern(b).bestParts,
    date: best,
    activeDays30,
    total: total(b),
  }
}

/** The energy chosen on each weekday (Low, Balanced, High), for "how your week feels". */
export function energyByWeekday(energyByDay: Record<string, string> | undefined) {
  const rows = WEEK.map((w) => ({ weekday: w.name, short: w.short, worst: 0, average: 0, best: 0 }))
  for (const [date, level] of Object.entries(energyByDay || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(level === 'worst' || level === 'average' || level === 'best')) continue
    rows[weekdayIndex(date)][level]++
  }
  const chosen = rows.reduce((n, r) => n + r.worst + r.average + r.best, 0)
  return { rows, chosen, highDays: top(rows, (r) => r.best).map((r) => r.weekday), lowDays: top(rows, (r) => r.worst).map((r) => r.weekday) }
}

/** "Tuesday", "Tuesday and Thursday", "Monday, Tuesday and Friday". */
export function listOf(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export const hourLabel = (h: number) => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`)
