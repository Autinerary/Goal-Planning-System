import {
  addDays, eachDayOfInterval, endOfMonth, endOfWeek,
  format, isSameDay, parseISO, startOfMonth, startOfWeek,
} from 'date-fns'

/**
 * The calendar's data model, now that tasks can carry real dates.
 *
 * Two kinds of task coexist here, and both are legitimate:
 *
 *   recurring  scheduledDate === null, repeats every week on `day`. This is
 *              what the path-planning agents actually produce — the backend's
 *              schedule[] is a weekly template keyed by day name, with no
 *              dates anywhere in it.
 *   dated      scheduledDate set — a one-time task on an actual date.
 *
 * Everything the views render goes through occurrencesInRange(), so neither
 * kind is a special case at the UI layer.
 */

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

export interface CalendarTask {
  id: string
  name: string
  /** Weekday name — used when scheduledDate is null. */
  day: string
  /** 'HH:MM', 24-hour. */
  time: string
  /** ISO yyyy-mm-dd, or null for a weekly recurring task. */
  scheduledDate: string | null
  durationMinutes: number | null
  priority: string
  source?: string
  completed?: boolean
}

/** One task on one specific day — what a grid cell actually draws. */
export interface Occurrence {
  task: CalendarTask
  date: Date
  /** Minutes from midnight, for positioning on a time grid. */
  startMinutes: number
  durationMinutes: number
  /** True when this came from a weekly template rather than a real date. */
  recurring: boolean
}

/** Default block length when a task has no parsed duration. 30 minutes is the
 *  smallest slot the grid draws, so this is the minimum honest footprint —
 *  not a guess at how long the task really takes. */
export const DEFAULT_DURATION_MINUTES = 30

export function parseTimeToMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time || '').trim())
  if (!m) return 9 * 60
  const h = Math.min(23, Math.max(0, Number(m[1])))
  const min = Math.min(59, Math.max(0, Number(m[2])))
  return h * 60 + min
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Parse the legacy human-readable duration string ('1 hr', '30 min').
 * Returns null rather than a fallback, so callers can tell "unknown length"
 * apart from "genuinely 30 minutes".
 */
export function parseDurationString(duration?: string | null): number | null {
  if (!duration) return null
  const s = duration.trim().toLowerCase()
  const hoursHalf = /^(\d+)\s*\.\s*5\s*(hr|hrs|hour|hours)$/.exec(s)
  if (hoursHalf) return Number(hoursHalf[1]) * 60 + 30
  const hours = /^(\d+)\s*(hr|hrs|hour|hours)$/.exec(s)
  if (hours) return Number(hours[1]) * 60
  const mins = /^(\d+)\s*(min|mins|minute|minutes)$/.exec(s)
  if (mins) return Number(mins[1])
  return null
}

/** Every occurrence of every task that falls inside [from, to], inclusive. */
export function occurrencesInRange(
  tasks: CalendarTask[],
  from: Date,
  to: Date
): Occurrence[] {
  const days = eachDayOfInterval({ start: from, end: to })
  const out: Occurrence[] = []

  for (const task of tasks) {
    const duration = task.durationMinutes ?? DEFAULT_DURATION_MINUTES
    const startMinutes = parseTimeToMinutes(task.time)

    if (task.scheduledDate) {
      // A real date: exactly one occurrence, and only if it's in view.
      const d = parseISO(task.scheduledDate)
      if (days.some((day) => isSameDay(day, d))) {
        out.push({ task, date: d, startMinutes, durationMinutes: duration, recurring: false })
      }
      continue
    }

    // Weekly template: one occurrence per matching weekday in the range.
    for (const day of days) {
      if (WEEKDAYS[day.getDay()] === task.day) {
        out.push({ task, date: day, startMinutes, durationMinutes: duration, recurring: true })
      }
    }
  }

  return out.sort((a, b) =>
    a.date.getTime() - b.date.getTime() || a.startMinutes - b.startMinutes
  )
}

/** The 6-week grid a month view draws, including leading/trailing days. */
export function monthGridDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  })
}

export function weekDays(anyDayInWeek: Date): Date[] {
  const start = startOfWeek(anyDayInWeek)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const toISODate = (d: Date) => format(d, 'yyyy-MM-dd')

/** Overlapping blocks share the column width, the way GCal lays out a clash. */
export function layoutDayColumn(occurrences: Occurrence[]): Array<Occurrence & { lane: number; lanes: number }> {
  const sorted = [...occurrences].sort((a, b) => a.startMinutes - b.startMinutes)
  const laid: Array<Occurrence & { lane: number; lanes: number }> = []
  // Groups of mutually-overlapping events; every member gets the same `lanes`
  // count so their widths add up to exactly one column.
  let group: Array<Occurrence & { lane: number; lanes: number }> = []
  let groupEnd = -1

  const flush = () => {
    const lanes = group.reduce((m, g) => Math.max(m, g.lane + 1), 0)
    group.forEach((g) => { g.lanes = lanes; laid.push(g) })
    group = []
    groupEnd = -1
  }

  for (const occ of sorted) {
    const end = occ.startMinutes + occ.durationMinutes
    if (group.length > 0 && occ.startMinutes >= groupEnd) flush()

    const taken = new Set(
      group.filter((g) => g.startMinutes + g.durationMinutes > occ.startMinutes).map((g) => g.lane)
    )
    let lane = 0
    while (taken.has(lane)) lane++

    group.push({ ...occ, lane, lanes: 1 })
    groupEnd = Math.max(groupEnd, end)
  }
  if (group.length > 0) flush()

  return laid
}
