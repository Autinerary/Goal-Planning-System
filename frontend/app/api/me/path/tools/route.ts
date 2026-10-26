import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activePathRow, planMilestones, planTools, updateActivePath } from '@/lib/activePath'
import {
  MAX_REACHED, MAX_TOOLS, cleanEdits, excludedKeys, toolKey, visibleTools, withAdded, withRemoved, withRestored,
  type PlanTool, type ToolEdits,
} from '@/lib/milestoneTools'
import { rankMore } from '@/lib/moreTools'
import { hubPool } from '@/lib/hubPool'

export const dynamic = 'force-dynamic'

const HUB_URL = process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001'

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
