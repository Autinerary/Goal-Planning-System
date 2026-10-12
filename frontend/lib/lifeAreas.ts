/**
 * One life area first.
 *
 * Every goal's plan has four life areas (education, workplace, relationships,
 * health; backend/core/agents/path_planning_agent.py), four milestones each.
 * Riipen Labs, Group 20 (September 2026): new users are "introduced to four
 * life paths" at once, and they recommended to "Sequence the four life-path
 * categories. Start with one, and reveal the others after a first step. The
 * categories stay the same; only when they appear changes."
 *
 * So until someone finishes their first milestone, the plan's pages show the
 * area they start in, and say which areas come next and how many steps each
 * has. "Show all four now" is always there, and nothing is removed: the
 * milestones are all in the plan, ticked or not. Pure functions; tested by
 * lib/lifeAreas.test.mjs.
 */

export const AREA_LABEL: Record<string, string> = {
  education: 'Education',
  workplace: 'Workplace',
  relationships: 'Relationships',
  health: 'Health & Lifestyle',
}

export interface AreaMilestone {
  id: string
  dimension?: string
  category?: string
  dimensionLabel?: string
}

/** The milestone's area key ('career' is the planner's older name for workplace). */
export function areaOf(m: AreaMilestone): string {
  const k = String(m.dimension || m.category || '').toLowerCase()
  return k === 'career' ? 'workplace' : k
}

export interface HiddenArea {
  area: string
  label: string
  count: number
}

export interface AreaView {
  /** Show everything. */
  all: boolean
  /** The one area shown while the others wait. */
  firstArea: string | null
  firstLabel: string | null
  hidden: HiddenArea[]
}

const ALL: AreaView = { all: true, firstArea: null, firstLabel: null, hidden: [] }

/**
 * Which areas a plan's pages show. Everything once someone chose to see it,
 * once any milestone is done, or when a plan has fewer than two areas (older
 * plans have none). Otherwise the area of the plan's first milestone.
 */
export function lifeAreaView(milestones: AreaMilestone[], completedIds: Set<string>, revealed: boolean): AreaView {
  if (revealed || milestones.some((m) => completedIds.has(m.id))) return ALL
  const order: string[] = []
  const counts: Record<string, number> = {}
  const labels: Record<string, string> = {}
  for (const m of milestones) {
    const area = areaOf(m)
    if (!area) return ALL
    if (!(area in counts)) { order.push(area); counts[area] = 0; labels[area] = m.dimensionLabel || AREA_LABEL[area] || area }
    counts[area]++
  }
  if (order.length < 2) return ALL
  const [first, ...rest] = order
  return {
    all: false,
    firstArea: first,
    firstLabel: labels[first],
    hidden: rest.map((area) => ({ area, label: labels[area], count: counts[area] })),
  }
}

/** The milestones to show. */
export function visibleMilestones<T extends AreaMilestone>(milestones: T[], view: AreaView): T[] {
  return view.all ? milestones : milestones.filter((m) => areaOf(m) === view.firstArea)
}

/** "Workplace, Relationships and Health & Lifestyle". */
export function areaList(hidden: HiddenArea[]): string {
  const names = hidden.map((h) => h.label)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Set by "Show all four now", on this device. */
export const AREAS_REVEALED_KEY = 'autinerary_life_areas_revealed'
