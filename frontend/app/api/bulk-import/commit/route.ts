import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/bulk-import/commit — write the items the user confirmed.
 *
 * Two destinations, because they are genuinely different things:
 *   milestones -> milestone_suggestions (new; milestones had no user
 *                 submission path at all before this)
 *   resources  -> resources, the same table the single-resource form uses
 *
 * Both land as status='pending'. A bulk paste is exactly how fifty
 * half-formed lines reach a shared catalogue, so nothing here goes live
 * without review — the same rule path_models and role_models already follow.
 *
 * Everything from one paste shares a batch_id so a reviewer can act on it as
 * a unit and the submitter can see what they sent.
 */

const RESOURCE_CATEGORIES = new Set([
  'therapist', 'school', 'doctor', 'park', 'store', 'app', 'book',
  'support_group', 'organization', 'workshop', 'recreation', 'other',
])
const DIMENSIONS = new Set(['education', 'workplace', 'relationships', 'health', 'barrier'])

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const items: any[] = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
  }
  if (items.length > 200) {
    return NextResponse.json({ error: 'Too many items in one batch (max 200).' }, { status: 413 })
  }

  const batchId = randomUUID()

  // Re-validate server-side. The client can edit every field, so trusting the
  // shape that comes back would let a crafted request write an invalid
  // dimension or category straight past the UI's own dropdowns.
  const milestones = items
    .filter((it) => it?.kind === 'milestone' && typeof it?.name === 'string' && it.name.trim())
    .map((it) => ({
      name: String(it.name).trim().slice(0, 200),
      description: typeof it.description === 'string' && it.description.trim()
        ? it.description.trim().slice(0, 1000) : null,
      dimension: DIMENSIONS.has(it.dimension) ? it.dimension : 'education',
      category_key: typeof it.categoryKey === 'string' && it.categoryKey ? it.categoryKey : null,
      submitted_by: user.id,
      batch_id: batchId,
      status: 'pending',
    }))
    // The table's own CHECK requires 3-200 chars; filtering here gives a
    // clean count back instead of failing the whole insert on one bad row.
    .filter((m) => m.name.length >= 3)

  const resources = items
    .filter((it) => it?.kind === 'resource' && typeof it?.name === 'string' && it.name.trim())
    .map((it) => ({
      name: String(it.name).trim().slice(0, 200),
      description: typeof it.description === 'string' && it.description.trim()
        ? it.description.trim().slice(0, 1000) : null,
      category: RESOURCE_CATEGORIES.has(it.resourceCategory) ? it.resourceCategory : 'other',
      submitted_by: user.id,
      status: 'pending',
    }))

  const result = { milestones: 0, resources: 0, batchId }

  if (milestones.length > 0) {
    const { error, count } = await supabase
      .from('milestone_suggestions')
      .insert(milestones, { count: 'exact' })
    if (error) {
      console.error('[bulk-import/commit] milestones:', error.message)
      return NextResponse.json(
        { error: `Could not save the milestones: ${error.message}` },
        { status: 500 }
      )
    }
    result.milestones = count ?? milestones.length
  }

  if (resources.length > 0) {
    const { error, count } = await supabase
      .from('resources')
      .insert(resources, { count: 'exact' })
    if (error) {
      console.error('[bulk-import/commit] resources:', error.message)
      // Milestones may already be in. Report honestly rather than implying
      // the whole batch failed — the user needs to know not to re-paste.
      return NextResponse.json(
        {
          error: `Saved ${result.milestones} milestone(s), but the resources failed: ${error.message}`,
          partial: true,
          ...result,
        },
        { status: 500 }
      )
    }
    result.resources = count ?? resources.length
  }

  return NextResponse.json({ ok: true, ...result })
}
