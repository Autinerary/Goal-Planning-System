import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * GET /api/me/resource-status
 * Returns the signed-in user's saved resources as { resourceId: status } so the
 * Milestone View can show Wishlist / Currently Using as already-set on load.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ statuses: {} })
  }

  const { data, error } = await supabase
    .from('saved_resources')
    .select('resource_id, status')
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ statuses: {} })
  }

  const statuses: Record<string, string> = {}
  ;(data || []).forEach((row: any) => {
    if (row.resource_id && row.status) statuses[row.resource_id] = row.status
  })
  return NextResponse.json({ statuses })
}

/**
 * POST /api/me/resource-status
 * Save (or update the status of) a ResourceHub resource for the signed-in user,
 * writing directly to the shared Supabase `saved_resources` table. This lets the
 * Milestone View's Wishlist / Currently Using toggles persist server-side without
 * a cross-origin call to ServiceHub (both apps share one Supabase project).
 *
 * Body: { resourceId: string (uuid), status: 'wishlist' | 'current' | 'past' | null }
 *   - status null removes the saved row (un-save).
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

  const rawResourceId: string | undefined = body?.resourceId
  const name: string = typeof body?.name === 'string' ? body.name.trim() : ''
  const status: string | null = body?.status ?? null

  if (status !== null && !['wishlist', 'current', 'past'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const isUuid = typeof rawResourceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawResourceId)

  // Resolve to a REAL ResourceHub resource id. Milestone tools often carry a
  // synthetic id (or none), which previously meant the save silently no-op'd and
  // never showed up in ResourceHub (Odosa's bug). We (a) verify a passed UUID
  // actually exists and (b) otherwise match the tool name to a catalogued
  // resource — so wishlisting works whenever the tool maps to a real resource.
  let realId: string | null = null
  if (isUuid) {
    const { data } = await supabase.from('resources').select('id').eq('id', rawResourceId).limit(1)
    if (data && data.length) realId = rawResourceId as string
  }
  if (!realId && name) {
    const { data } = await supabase.from('resources').select('id').ilike('name', name).limit(1)
    if (data && data.length) realId = data[0].id
  }

  if (!realId) {
    // Not a catalogued resource — report honestly so the client can show a note
    // instead of a fake "wishlisted" state that never persists.
    return NextResponse.json({ ok: false, reason: 'not_in_resourcehub' })
  }

  // Un-save when status is null.
  if (status === null) {
    const { error } = await supabase
      .from('saved_resources')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', realId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true, resourceId: realId })
  }

  // Upsert the saved row with the chosen status.
  const { error } = await supabase
    .from('saved_resources')
    .upsert(
      { user_id: user.id, resource_id: realId, status },
      { onConflict: 'user_id,resource_id' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status, resourceId: realId })
}
