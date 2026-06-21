import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * PATCH /api/my-resources/saved/[id]/build-team
 *
 * Body: { calls_scheduled?: boolean; contract_sent?: boolean; promote?: boolean }
 *
 * - `calls_scheduled` / `contract_sent`: toggles the corresponding progress
 *   flag on the saved_resources row that belongs to (user, resource_id).
 * - `promote: true`: moves the row from status='wishlist' to status='current'
 *   and stamps added_to_team_at. Used by the "Add to Team" confirmation modal.
 *
 * Always returns the updated row.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    if (typeof body.calls_scheduled === 'boolean') {
      updates.calls_scheduled = body.calls_scheduled
    }
    if (typeof body.contract_sent === 'boolean') {
      updates.contract_sent = body.contract_sent
    }
    if (body.promote === true) {
      updates.status = 'current'
      updates.added_to_team_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('saved_resources')
      .update(updates)
      .eq('user_id', user.id)
      .eq('resource_id', params.id)
      .select()
      .single()

    if (error) {
      console.error('build-team PATCH error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, savedResource: data })
  } catch (error) {
    console.error('build-team PATCH unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
