// Real progress computation for races.
//
// A race's progress = the percentage of that race's milestones the user has
// actually marked complete. Completion is persisted server-side in the
// `race_progress` table and surfaced via GET /api/me/progress. Milestones are
// attributed to a race by `raceId` first (e.g. "race_0" from the path agent),
// then by matching the goal text. When nothing can be attributed we return
// null so the caller can fall back to a stored/placeholder value instead of
// showing a misleading 0%.

export interface ProgressMilestone {
  id: string
  goal?: string
  raceId?: string
  dimension?: string
}

const norm = (s?: string) => (s || '').trim().toLowerCase()

/** Fetch the set of completed milestone ids for the signed-in user. */
export async function fetchCompletedMilestoneIds(): Promise<Set<string>> {
  try {
    const res = await fetch('/api/me/progress?kind=completed', {
      cache: 'no-store',
      credentials: 'include',
    })
    if (!res.ok) return new Set()
    const json = await res.json()
    const ids = new Set<string>()
    for (const row of json.progress || []) {
      if (row.kind === 'completed' && row.milestone_id) ids.add(row.milestone_id)
    }
    return ids
  } catch {
    return new Set()
  }
}

/**
 * Progress for a single race = % of that race's milestones marked completed.
 * Returns null when no milestones can be attributed to the race.
 */
export function computeRaceProgress(
  race: { id?: string; name?: string },
  milestones: ProgressMilestone[],
  completedIds: Set<string>
): number | null {
  if (!milestones.length) return null

  const byRaceId = race.id
    ? milestones.filter((m) => m.raceId && norm(m.raceId) === norm(race.id))
    : []
  const matched = byRaceId.length
    ? byRaceId
    : milestones.filter((m) => m.goal && norm(m.goal) === norm(race.name))

  if (!matched.length) return null
  const done = matched.filter((m) => completedIds.has(m.id)).length
  return Math.round((done / matched.length) * 100)
}

/** Overall progress = % of ALL milestones completed. Null when none exist. */
export function computeOverallProgress(
  milestones: ProgressMilestone[],
  completedIds: Set<string>
): number | null {
  if (!milestones.length) return null
  const done = milestones.filter((m) => completedIds.has(m.id)).length
  return Math.round((done / milestones.length) * 100)
}
