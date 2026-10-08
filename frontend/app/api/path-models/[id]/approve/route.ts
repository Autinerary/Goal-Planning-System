import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/path-models/[id]/approve  → { action: 'approve' | 'reject' }
 *
 * Moderates a community-submitted model. Admins are the people in
 * public.admin_users (STEP 55). Both the check and the write run as the
 * signed-in person, through RLS: rpc('is_admin') gives a clear 403, and the
 * update itself is allowed only by the "path_models_admin_review" policy,
 * only for admins and only on the status column.
 *
 * This used to check ADMIN_EMAILS (never set in Vercel, so nobody could
 * approve) and then write with the service_role key, which bypasses every
 * policy. It is the worked example of moving an admin action off that key.
 */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin')
  if (adminError || isAdmin !== true) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = (ctx.params?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let action = 'approve'
  try {
    const body = await req.json()
    if (body?.action === 'reject') action = 'reject'
  } catch {
    /* default approve */
  }
  const status = action === 'reject' ? 'rejected' : 'approved'

  const { data, error } = await supabase.from('path_models').update({ status }).eq('id', id).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'No such path model' }, { status: 404 })
  return NextResponse.json({ ok: true, status })
}
