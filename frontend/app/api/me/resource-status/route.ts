import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

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

  const resourceId: string | undefined = body?.resourceId
  const status: string | null = body?.status ?? null

  // Only accept real UUIDs — agent/knowledge-base tools use synthetic ids and
  // must be ignored so we never write junk rows.
  const isUuid = typeof resourceId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resourceId)
  if (!isUuid) {
    return NextResponse.json({ error: 'A valid resourceId (uuid) is required' }, { status: 400 })
  }
  if (status !== null && !['wishlist', 'current', 'past'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Un-save when status is null.
  if (status === null) {
    const { error } = await supabase
      .from('saved_resources')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true })
  }

  // Upsert the saved row with the chosen status.
  const { error } = await supabase
    .from('saved_resources')
    .upsert(
      { user_id: user.id, resource_id: resourceId, status },
      { onConflict: 'user_id,resource_id' }
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, status })
}
