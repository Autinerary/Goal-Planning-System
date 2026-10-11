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
