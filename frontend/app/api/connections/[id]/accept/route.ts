import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/connections/[id]/accept
 * The current user (must be the request's target_user_id) flips status to 'connected'.
 * RLS policy "Receivers can accept their pending requests" enforces this server-side too.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const id = params.id
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  // The row's `role` is a human-readable subtitle, but when a request is
  // sent it is filled with the placeholder text 'Pending Request'. Accept
  // used to flip only `status`, so the card kept reading "Pending Request"
  // to both people after the request had been accepted — the bug testers
  // reported. Clear the placeholder here, and only the placeholder, so a
  // role someone actually typed is left alone.
  const PLACEHOLDER_ROLES = ['Pending Request', 'Pending Connection']

  const { data: existing } = await supabase
    .from('social_connections')
    .select('role')
    .eq('id', id)
    .eq('target_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  const patch: { status: string; role?: string } = { status: 'connected' }
  if (existing && PLACEHOLDER_ROLES.includes((existing.role || '').trim())) {
    patch.role = ''
  }

  const { data, error } = await supabase
    .from('social_connections')
    .update(patch)
    .eq('id', id)
    .eq('target_user_id', user.id)
    .eq('status', 'pending')
    .select('id, status, role, owner_id, target_user_id, category')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Request not found or already actioned' }, { status: 404 })

  return NextResponse.json({ connection: data })
}
