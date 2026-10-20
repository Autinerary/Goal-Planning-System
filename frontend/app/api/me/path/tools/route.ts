import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activePathRow, planMilestones, planTools, updateActivePath } from '@/lib/activePath'
import {
  MAX_REACHED, MAX_TOOLS, cleanEdits, excludedKeys, toolKey, visibleTools, withAdded, withRemoved, withRestored,
  type PlanTool, type ToolEdits,
} from '@/lib/milestoneTools'
import { rankMore, type PoolRow, type RatingAgg } from '@/lib/moreTools'

export const dynamic = 'force-dynamic'

const HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

// ResourceHub's listings and ratings, read at most every ten minutes and
// shared: the same pool the plan's own picks came from (the services checked
// on their own sites, and everything people have rated).
let cache: { at: number; pool: PoolRow[]; ratings: Map<string, RatingAgg> } | null = null

async function hubPool(admin: ReturnType<typeof createAdminClient>) {
  if (cache && Date.now() - cache.at < 10 * 60 * 1000) return cache
  const ratings = new Map<string, RatingAgg>()
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await admin.from('ratings').select('resource_id, overall_score, barrier_scores').range(from, from + 999)
    if (error) break
    for (const r of data || []) {
      if (!r.resource_id) continue
      const agg = ratings.get(r.resource_id) || { sum: 0, count: 0, norms: {} }
      if (typeof r.overall_score === 'number') {
        agg.sum += r.overall_score
        agg.count += 1
      }
      for (const key of Object.keys((r.barrier_scores as Record<string, unknown>) || {})) agg.norms[key] = (agg.norms[key] || 0) + 1
      ratings.set(r.resource_id, agg)
    }
    if ((data || []).length < 1000) break
  }
  const cols = 'id, name, description, category, tags, cost_type, price, contact_info, is_first_party'
  const { data: checked } = await admin.from('resources').select(cols).eq('status', 'approved').eq('source_type', 'operator').limit(3000)
  const have = new Set((checked || []).map((r: any) => r.id))
  const ratedIds = Array.from(ratings.keys()).filter((id) => !have.has(id))
  const rated: any[] = []
  for (let i = 0; i < ratedIds.length; i += 100) {
    const { data } = await admin.from('resources').select(cols).eq('status', 'approved').in('id', ratedIds.slice(i, i + 100))
    rated.push(...(data || []))
  }
  const pool: PoolRow[] = [...(checked || []), ...rated].map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    tags: Array.isArray(r.tags) ? r.tags : [],
    cost_type: r.cost_type ?? null,
    price: r.price ?? null,
    website: r.contact_info?.website || null,
    is_first_party: r.is_first_party ?? null,
  }))
  cache = { at: Date.now(), pool, ratings }
  return cache
}

/**
 * A milestone's tools (the team's notes on the Milestone view, October 2026):
 *   POST { milestoneId, action: 'remove', key }   take a tool off the list
 *   POST { milestoneId, action: 'restore', key }  put it back
 *   POST { milestoneId, action: 'more' }          add the next best one, until
 *                                                 there are 5 (MAX_REACHED)
 * Kept in the plan (payload.toolEdits), so the list is the same on every
 * device; the plan's own recommendations are never changed. Returns the
 * milestone's edits.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const milestoneId = typeof body?.milestoneId === 'string' ? body.milestoneId.slice(0, 200) : ''
  const action = body?.action
  const key = typeof body?.key === 'string' ? body.key.slice(0, 200) : ''
  if (!milestoneId || !['remove', 'restore', 'more'].includes(action)) {
    return NextResponse.json({ error: 'Say which milestone, and remove, restore or more.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const row = await activePathRow(admin, user.id)
  if (!row) return NextResponse.json({ error: 'No plan yet.' }, { status: 404 })
  const milestone = planMilestones(row.payload).find((m) => m.id === milestoneId)
  if (!milestone) return NextResponse.json({ error: 'That milestone isn’t in your plan.' }, { status: 404 })

  const base = planTools(row.payload, milestoneId)
  const edits = cleanEdits(row.payload.toolEdits?.[milestoneId])
  let next: ToolEdits = edits
  let added: PlanTool | null = null

  if (action === 'remove') {
    if (!visibleTools(base, edits).some((t) => toolKey(t) === key)) return NextResponse.json({ error: 'That tool isn’t on the list.' }, { status: 400 })
    next = withRemoved(edits, key)
  } else if (action === 'restore') {
    if (!edits.removed.includes(key)) return NextResponse.json({ edits, full: visibleTools(base, edits).length >= MAX_TOOLS })
    if (visibleTools(base, edits).length >= MAX_TOOLS) return NextResponse.json({ error: MAX_REACHED, full: true }, { status: 409 })
    next = withRestored(edits, key)
  } else {
    if (visibleTools(base, edits).length >= MAX_TOOLS) return NextResponse.json({ error: MAX_REACHED, full: true }, { status: 409 })
    const exclude = excludedKeys(base, edits)
    // The plan's own next pick first (it ranked six), then ResourceHub's best match.
    added = base.find((t) => !exclude.has(toolKey(t))) || null
    if (!added) {
      const { pool, ratings } = await hubPool(admin)
      const norms = Array.isArray(row.payload.userProfile?.barrierTypes) ? row.payload.userProfile.barrierTypes : []
      added = rankMore(pool, milestone, { exclude, norms, ratings, limit: 1, hubUrl: HUB_URL })[0] || null
    }
    if (!added) {
      return NextResponse.json({ edits, added: null, full: false, message: 'Nothing else in ResourceHub matches this milestone yet.' })
    }
    next = withAdded(base, edits, added)
  }

  const saved = await updateActivePath(admin, user.id, row.path_id, (payload) => ({
    ...payload,
    toolEdits: { ...(payload.toolEdits && typeof payload.toolEdits === 'object' ? payload.toolEdits : {}), [milestoneId]: next },
  }))
  if (!saved) return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 409 })
  return NextResponse.json({ edits: next, added, full: visibleTools(base, next).length >= MAX_TOOLS })
}
