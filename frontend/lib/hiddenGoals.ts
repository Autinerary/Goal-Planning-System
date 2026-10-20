/**
 * Goals taken out of a plan in "Your Goals, Dreams & Obstacles" (the Race
 * view; the team's notes, October 2026: "customizable here, so someone
 * doesn't need to re-do the entire onboarding"). Nothing is deleted: the
 * goal stays in the plan, listed in userProfile.hiddenGoals, and this hides
 * it, its race, its milestones, their tasks, tools and calendar entries
 * from every page (app/context/AgentPathContext.tsx applies it once).
 * Adding the same goal again brings it all back.
 */

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

export function hiddenGoalSet(payload: any): Set<string> {
  const list = payload?.userProfile?.hiddenGoals
  return new Set((Array.isArray(list) ? list : []).map(norm).filter(Boolean))
}

// Drop any entry belonging to a hidden milestone, however deep a schedule nests them.
function prune(value: any, ids: Set<string>): any {
  if (Array.isArray(value)) {
    return value
      .filter((v) => !(v && typeof v === 'object' && typeof v.milestoneId === 'string' && ids.has(v.milestoneId)))
      .map((v) => prune(v, ids))
  }
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) out[k] = prune(v, ids)
    return out
  }
  return value
}

/** The plan as the pages show it: without the goals the person took out. */
export function withoutHiddenGoals<T extends Record<string, any> | null>(payload: T): T {
  if (!payload) return payload
  const hidden = hiddenGoalSet(payload)
  if (!hidden.size) return payload
  const isHidden = (m: any) => hidden.has(norm(m?.goal))
  const ids = new Set<string>()
  const responses: any[] = Array.isArray(payload.agentResponses) ? payload.agentResponses : []
  const planning = responses.find((r) => r?.agentId === 'path_planning')?.result
  for (const m of planning?.milestones || []) if (isHidden(m) && m?.id) ids.add(m.id)
  for (const race of payload.races || []) for (const m of race?.milestones || []) if (isHidden(m) && m?.id) ids.add(m.id)
  for (const m of payload.milestones || []) if (isHidden(m) && m?.id) ids.add(m.id)

  const keepMilestone = (m: any) => !(m?.id && ids.has(m.id)) && !isHidden(m)
  const races = (payload.races || [])
    .filter((r: any) => !hidden.has(norm(r?.goal)) && !hidden.has(norm(r?.name)))
    .map((r: any) => (Array.isArray(r?.milestones) ? { ...r, milestones: r.milestones.filter(keepMilestone) } : r))

  const agentResponses = responses.map((r) => {
    if (!r || typeof r !== 'object' || !r.result || typeof r.result !== 'object') return r
    if (r.agentId === 'path_planning') {
      return {
        ...r,
        result: {
          ...r.result,
          milestones: (r.result.milestones || []).filter(keepMilestone),
          tasks: (r.result.tasks || []).filter((t: any) => !ids.has(t?.milestoneId)),
        },
      }
    }
    if (r.agentId === 'tool_recommendation' && r.result.recommendations && typeof r.result.recommendations === 'object') {
      const recommendations: Record<string, any> = {}
      for (const [k, v] of Object.entries(r.result.recommendations)) if (!ids.has(k)) recommendations[k] = v
      return { ...r, result: { ...r.result, recommendations } }
    }
    if (r.agentId === 'calendar_optimization') return { ...r, result: prune(r.result, ids) }
    return r
  })

  return {
    ...payload,
    races,
    agentResponses,
    ...(Array.isArray(payload.milestones) ? { milestones: payload.milestones.filter(keepMilestone) } : {}),
    ...(Array.isArray(payload.tasks) ? { tasks: payload.tasks.filter((t: any) => !ids.has(t?.milestoneId)) } : {}),
    ...(Array.isArray(payload.schedule) ? { schedule: prune(payload.schedule, ids) } : {}),
  }
}
