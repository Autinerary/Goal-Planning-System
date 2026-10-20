/**
 * The races for Track View's Separate (one race at a time), from the steps
 * themselves. Each step was made for a goal, and says which (`goal`, and a
 * `raceId`), so grouping by that can't come up empty while there are steps.
 *
 * The first version joined the plan's race list to the person's goals by name
 * and then to the steps by race id. Plans where those don't line up (goals
 * edited after the plan was made, or race ids missing from the race list)
 * showed "No races yet" to someone with 32 steps (20 October 2026).
 * Plain data and a pure function (lib/raceRoads.test.mjs).
 */

export interface RoadStep {
  id: string
  goal?: string
  raceId?: string
}

export interface RaceRoad<T> {
  /** Stable key for the race: its goal, else its race id. */
  id: string
  name: string
  /** Its steps you can see now (one life area first may hide some). */
  steps: T[]
  /** Its steps in areas not open yet. */
  later: number
}

const norm = (s: unknown) => String(s || '').trim().toLowerCase()
const keyOf = (m: RoadStep) => norm(m.goal) || (m.raceId ? `race:${m.raceId}` : 'your-race')

/**
 * @param all      every step in the plan, in order
 * @param visible  the steps shown now (a subset of `all`, same ids)
 * @param names    what to call a race: the person's goals and the plan's races
 */
export function raceRoads<T extends RoadStep>(
  all: RoadStep[],
  visible: T[],
  names: { goals?: string[]; races?: { id?: string; name?: string; goal?: string }[] } = {},
): RaceRoad<T>[] {
  const order: string[] = []
  const firstOf: Record<string, RoadStep> = {}
  const count: Record<string, number> = {}
  for (const m of all) {
    const k = keyOf(m)
    if (!(k in count)) {
      order.push(k)
      firstOf[k] = m
      count[k] = 0
    }
    count[k]++
  }
  const nameFor = (k: string, i: number) => {
    const m = firstOf[k]
    // The person's own wording of the goal when it matches, else the step's.
    const goal = (names.goals || []).find((g) => norm(g) === norm(m.goal))
    if (goal) return goal
    if (m.goal && String(m.goal).trim()) return String(m.goal).trim()
    const race = (names.races || []).find((r) => r.id && r.id === m.raceId)
    if (race?.name || race?.goal) return String(race.name || race.goal)
    return (names.goals || [])[i] || (order.length > 1 ? `Race ${i + 1}` : 'Your race')
  }
  return order.map((k, i) => {
    const steps = visible.filter((m) => keyOf(m) === k)
    return { id: k, name: nameFor(k, i), steps, later: Math.max(0, count[k] - steps.length) }
  })
}
