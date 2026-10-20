// Plan tasks (the ones the agents scheduled) that someone ticked off, in the
// calendar, the task list or a task's own page. They used to be kept only in
// memory, so leaving the calendar and coming back undid every tick (Riipen
// Labs, Group 34: "Calendar resets"). Saved with the person's preferences
// (profiles.preferences.planTaskDone, and this browser), as the Monday of the
// week each was ticked: plan tasks repeat every week, so a tick counts for the
// week it was made in. Tasks people add themselves keep their own completed
// flag in calendar_tasks.

export type PlanTaskDone = Record<string, string>

const KEEP_WEEKS = 8

/** The Monday of `date`'s week, in local time, as YYYY-MM-DD. */
export function weekKey(date: Date = new Date()): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The plan tasks done this week, as a set of ids. */
export function doneThisWeek(done: PlanTaskDone | undefined, now: Date = new Date()): Set<string> {
  const week = weekKey(now)
  return new Set(Object.entries(done || {}).filter(([, w]) => w === week).map(([id]) => id))
}

/** Tick or untick one task for this week, dropping ticks older than eight weeks. */
export function togglePlanTaskDone(done: PlanTaskDone | undefined, id: string, now: Date = new Date()): PlanTaskDone {
  const week = weekKey(now)
  const oldest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_WEEKS * 7)
  const next: PlanTaskDone = {}
  for (const [taskId, w] of Object.entries(done || {})) {
    if (taskId !== id && w >= weekKey(oldest)) next[taskId] = w
  }
  if ((done || {})[id] !== week) next[id] = week
  return next
}

/**
 * When plan tasks were ticked, for the Calendar's Analysis (Odosa, October
 * 2026: "your daily, weekly & monthly patterns, as well as your best
 * day(s)"): the local date, then the hour, then how many. A tick above only
 * keeps its week, which can't say which day or what time. Kept from 20
 * October 2026, for half a year.
 */
export type DoneHours = Record<string, Record<string, number>>
/** Each ticked task's date and hour ('YYYY-MM-DD@H'), so unticking takes back the right one. */
export type PlanTaskAt = Record<string, string>

const KEEP_HOUR_DAYS = 183
const dayOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Tick or untick a plan task: its week (as togglePlanTaskDone), and when it
 * was done. Returns the preferences to save, and whether it is now done.
 */
export function tickPlanTask(
  prefs: { planTaskDone?: PlanTaskDone; doneHours?: DoneHours; planTaskAt?: PlanTaskAt },
  id: string,
  now: Date = new Date(),
): { planTaskDone: PlanTaskDone; doneHours: DoneHours; planTaskAt: PlanTaskAt; done: boolean } {
  const wasDone = doneThisWeek(prefs.planTaskDone, now).has(id)
  const planTaskDone = togglePlanTaskDone(prefs.planTaskDone, id, now)
  const oldest = dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_HOUR_DAYS))
  const doneHours: DoneHours = {}
  for (const [day, hours] of Object.entries(prefs.doneHours || {})) {
    if (day >= oldest && hours && typeof hours === 'object') doneHours[day] = { ...hours }
  }
  const planTaskAt: PlanTaskAt = {}
  for (const [taskId, at] of Object.entries(prefs.planTaskAt || {})) {
    if (planTaskDone[taskId] && typeof at === 'string') planTaskAt[taskId] = at
  }
  if (!wasDone) {
    const day = dayOf(now)
    const hour = String(now.getHours())
    doneHours[day] = { ...(doneHours[day] || {}), [hour]: (Number(doneHours[day]?.[hour]) || 0) + 1 }
    planTaskAt[id] = `${day}@${hour}`
  } else {
    const at = (prefs.planTaskAt || {})[id]
    const [day, hour] = typeof at === 'string' ? at.split('@') : []
    const count = Number(doneHours[day]?.[hour]) || 0
    if (count > 1) doneHours[day] = { ...doneHours[day], [hour]: count - 1 }
    else if (count === 1) {
      const { [hour]: _gone, ...rest } = doneHours[day]
      if (Object.keys(rest).length) doneHours[day] = rest
      else delete doneHours[day]
    }
    delete planTaskAt[id]
  }
  return { planTaskDone, doneHours, planTaskAt, done: !wasDone }
}
