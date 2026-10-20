/**
 * Today in a weekly plan, and tricks for its tasks (the Task tab and each
 * task's Task View).
 */

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * A schedule day's weekday: from its date, else its name. A date such as
 * "2026-10-06" is read as that calendar day; `new Date()` would read it as
 * midnight UTC, which is the evening before in the Americas.
 */
export function weekdayOf(day: any): string {
  const s = String(day?.date || '')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return WEEKDAY[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()]
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(day?.name || day?.day || '') : WEEKDAY[d.getDay()]
}

/** Today's day in a weekly schedule (the same weekday), else its first day. */
export function todayIn<T>(schedule: T[]): T | undefined {
  const name = WEEKDAY[new Date().getDay()]
  return schedule.find((d) => weekdayOf(d) === name) || schedule[0]
}

/** When a task has no tricks of its own yet: general ones that help many people. */
export const GENERAL_TRICKS = [
  'Start with the smallest first step: just open what you need.',
  'Set a timer for 10 minutes. You can stop when it rings.',
  'Work alongside someone, in person or on a call (body doubling).',
  'Write down where you stopped, so starting again is easy.',
]

/**
 * Today's trick (the team's notes, October 2026: "Today's trick/hack has the
 * tasks, instead of tricks/hacks"): one written for the first task not done
 * yet, else a general one, the same all day.
 */
export function trickForToday(tasks: { name: string; helperTricks?: unknown }[], done: Set<string> | ((t: any) => boolean)): { trick: string; task: string | null } {
  const isDone = typeof done === 'function' ? done : (t: any) => done.has(t.id)
  const next = tasks.find((t) => !isDone(t) && Array.isArray(t.helperTricks) && t.helperTricks.some((x) => typeof x === 'string' && x.trim()))
  if (next) {
    const own = (next.helperTricks as unknown[]).filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
    return { trick: own[new Date().getDate() % own.length], task: next.name }
  }
  return { trick: GENERAL_TRICKS[new Date().getDate() % GENERAL_TRICKS.length], task: null }
}
