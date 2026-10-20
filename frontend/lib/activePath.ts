import type { SupabaseClient } from '@supabase/supabase-js'
import { toolsFromRecs, type PlanTool } from './milestoneTools'

/**
 * The signed-in person's active plan (user_paths, the row /api/me/path
 * reads), for the server routes that change one part of it: a milestone's
 * tools (app/api/me/path/tools) and the goals, dreams and obstacles
 * (app/api/me/path/profile). Each change reads the row again just before
 * writing and sets only its own part, so another change saved meanwhile is
 * kept. Server only (the service role, after the route has checked who is
 * asking).
 */

export interface PathRow {
  path_id: string
  payload: Record<string, any>
}

export async function activePathRow(admin: SupabaseClient, userId: string): Promise<PathRow | null> {
  const { data, error } = await admin
    .from('user_paths')
    .select('path_id, payload')
    .eq('user_id', userId)
    .order('is_active', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data || !data.payload || typeof data.payload !== 'object') return null
  return data as PathRow
}

/**
 * Change the plan and save it: `change` gets the latest payload and returns
 * it changed. Returns the saved payload, or null when the plan changed hands
 * (another plan became active) or could not be saved.
 */
export async function updateActivePath(
  admin: SupabaseClient,
  userId: string,
  pathId: string,
  change: (payload: Record<string, any>) => Record<string, any>,
): Promise<Record<string, any> | null> {
  const latest = await activePathRow(admin, userId)
  if (!latest || latest.path_id !== pathId) return null
  const next = change(latest.payload)
  const { error } = await admin.from('user_paths').update({ payload: next }).eq('user_id', userId).eq('path_id', pathId)
  return error ? null : next
}

/** One agent's stored result in the plan ('path_planning', 'tool_recommendation'). */
export function agentResult(payload: Record<string, any>, agentId: string): Record<string, any> | null {
  const found = (Array.isArray(payload?.agentResponses) ? payload.agentResponses : []).find((r: any) => r?.agentId === agentId)
  return found?.result && typeof found.result === 'object' ? found.result : null
}

export interface PlanMilestone {
  id: string
  name: string
  description?: string
  goal?: string
  dimension?: string
}

/** Every milestone in the plan, once (its races first, then path planning's list). */
export function planMilestones(payload: Record<string, any>): PlanMilestone[] {
  const seen = new Map<string, PlanMilestone>()
  const add = (m: any) => {
    if (m && typeof m.id === 'string' && !seen.has(m.id)) {
      seen.set(m.id, { id: m.id, name: String(m.name || m.title || ''), description: m.description, goal: m.goal, dimension: m.dimension || m.category })
    }
  }
  for (const race of Array.isArray(payload?.races) ? payload.races : []) for (const m of Array.isArray(race?.milestones) ? race.milestones : []) add(m)
  for (const m of agentResult(payload, 'path_planning')?.milestones || []) add(m)
  return Array.from(seen.values())
}

/** The tools the plan recommended for a milestone, as the pages show them. */
export function planTools(payload: Record<string, any>, milestoneId: string): PlanTool[] {
  return toolsFromRecs(agentResult(payload, 'tool_recommendation')?.recommendations?.[milestoneId])
}
