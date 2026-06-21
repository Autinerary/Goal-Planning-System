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

  const { data, error } = await supabase
    .from('social_connections')
    .update({ status: 'connected' })
    .eq('id', id)
    .eq('target_user_id', user.id)
    .eq('status', 'pending')
    .select('id, status, owner_id, target_user_id, category')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Request not found or already actioned' }, { status: 404 })

  return NextResponse.json({ connection: data })
}
