import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/me/resource-rating
 * Returns the signed-in user's ratings as { resourceId: score } so the
 * Milestone View can show the 5-star Effectiveness as already-set on load.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ ratings: {} })
  }

  const { data, error } = await supabase
    .from('ratings')
    .select('resource_id, overall_score')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ ratings: {} })
  }

  const ratings: Record<string, number> = {}
  ;(data || []).forEach((row: any) => {
    if (row.resource_id && typeof row.overall_score === 'number') ratings[row.resource_id] = row.overall_score
  })
  return NextResponse.json({ ratings })
}

/**
 * POST /api/me/resource-rating
 * Rate a ResourceHub resource's effectiveness (1–5) for the signed-in user,
 * writing to the shared Supabase `ratings` table. Powers the Milestone View's
 * 5-star "Effectiveness" control so ratings feed the ResourceHub rating system.
 *
 * Body: { resourceId: string (uuid), score: 1..5 }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const resourceId: string | undefined = body?.resourceId
  const score = Number(body?.score)

  const isUuid = typeof resourceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId)
  if (!isUuid) {
    return NextResponse.json({ error: 'A valid resourceId (uuid) is required' }, { status: 400 })
  }
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Score must be between 1 and 5' }, { status: 400 })
  }

  // Only rate approved resources (mirrors ServiceHub's rule).
  const { data: resource } = await supabase
    .from('resources')
    .select('id, status')
    .eq('id', resourceId)
    .maybeSingle()
  if (!resource || resource.status !== 'approved') {
    return NextResponse.json({ error: 'Resource is not available for rating' }, { status: 400 })
  }

  // Upsert this user's rating for the resource.
  const { error } = await supabase
    .from('ratings')
    .upsert(
      { user_id: user.id, resource_id: resourceId, overall_score: score },
      { onConflict: 'resource_id,user_id' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, score })
}
