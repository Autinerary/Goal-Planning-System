/**
 * Which life area each goal belongs to, so the Race view shows a goal under
 * its own area only (the team's notes, October 2026: "the individual race
 * category goals should be under its associated race category ONLY (ex.
 * Graduate university for education ONLY, Get a job for workplace ONLY)").
 *
 * The person's own choice first: the area they wrote it under (saved with
 * the plan as userProfile.goalCategories since this change, or setup's
 * goalsByCategory in this browser). Plans made before that are sorted by
 * the goal's words, and the person can change it in "Your Goals, Dreams &
 * Obstacles".
 */

export type GoalArea = 'education' | 'career' | 'relationships' | 'health' | 'barrier' | 'other'

export const GOAL_AREA_IDS: readonly GoalArea[] = ['education', 'career', 'relationships', 'health', 'barrier', 'other']

export const isArea = (v: unknown): v is GoalArea => typeof v === 'string' && (GOAL_AREA_IDS as readonly string[]).includes(v)

/** The Race view's tab for an area (career is "Workplace" there; "other" has none). */
export const DIMENSION_FOR_AREA: Record<GoalArea, string | null> = {
  education: 'education',
  career: 'workplace',
  relationships: 'relationships',
  health: 'health',
  barrier: 'barrier',
  other: null,
}

const WORDS: [GoalArea, RegExp][] = [
  ['education', /\b(graduat\w*|school|universit\w*|college|degree|diploma|stud(y|ies|ying)|course\w*|class(es)?|exams?|grades?|semester|tutor\w*|homework|learn a trade|apprentice\w*|masters?|phd|med(ical)? school|mcat|program|languages?|fluen(t|cy)|literacy|reading|math)\b/i],
  ['career', /\b(jobs?|work(ing|place)?|career|business|interview\w*|resum[eé]s?|cv|employ\w*|intern(ship)?s?|promot\w*|hired?|hiring|salary|freelanc\w*|entrepreneur\w*|startup|volunteer\w*|coworkers?|boss)\b/i],
  ['relationships', /\b(friends?|friendship|family|partner|relationships?|social(i[sz]e)?|communicat\w*|dating|date|network\w*|community|connect\w*|siblings?|parents?|marriage|lonel\w*)\b/i],
  ['health', /\b(health\w*|eat(ing)?|diet|food|meals?|nutrition|exercis\w*|therap\w*|sleep|fitness|weight|mental|wellness|wellbeing|doctor|medic\w*|anxiety|stress|vegan\w*|gym|walk(ing)?|run(ning)?|recover\w*|sober\w*)\b/i],
  ['barrier', /\b(self[- ]?advoca\w*|advoca\w*|normali[sz]\w*|positivity|accommodations?|disclos\w*|stigma|self[- ]?accept\w*|confidence)\b/i],
]

/** The area a goal's words point to, or 'other'. */
export function guessGoalArea(goal: string): GoalArea {
  for (const [area, re] of WORDS) if (re.test(goal)) return area
  return 'other'
}

/**
 * Each goal's area: the plan's saved choice, else setup's in this browser,
 * else its words.
 */
export function goalAreas(
  goals: readonly string[],
  saved?: unknown,
  byCategory?: unknown,
): Record<string, GoalArea> {
  const out: Record<string, GoalArea> = {}
  const stored = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {}
  const fromSetup: Record<string, GoalArea> = {}
  if (byCategory && typeof byCategory === 'object') {
    for (const [area, entries] of Object.entries(byCategory as Record<string, unknown>)) {
      if (!isArea(area) || !Array.isArray(entries)) continue
      for (const e of entries) {
        const g = typeof e === 'string' ? e : (e as { goal?: unknown })?.goal
        if (typeof g === 'string' && g.trim()) fromSetup[g.trim().toLowerCase()] = area
      }
    }
  }
  for (const goal of goals) {
    const s = stored[goal]
    out[goal] = isArea(s) ? s : fromSetup[goal.trim().toLowerCase()] || guessGoalArea(goal)
  }
  return out
}

/** The goals that belong under one of the Race view's tabs. */
export function goalsForDimension(goals: readonly string[], areas: Record<string, GoalArea>, dimension: string): string[] {
  return goals.filter((g) => DIMENSION_FOR_AREA[areas[g] || 'other'] === dimension)
}
