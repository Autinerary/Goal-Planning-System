import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/stories/<id> { action: 'approve' | 'withdraw' }: the teller
 * approves the final version the team prepared, or takes the story back at
 * any time; a withdrawn story disappears from the site at once.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: { user } } = await createServerSupabase().auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const action = (await req.json().catch(() => null))?.action
  const admin = createAdminClient()
  const { data: story } = await admin.from('stories').select('id, user_id, status').eq('id', params.id).maybeSingle()
  if (!story || story.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const now = new Date().toISOString()
  let patch: Record<string, unknown> | null = null
  if (action === 'approve' && story.status === 'awaiting_approval') patch = { status: 'approved', approved_at: now }
  if (action === 'withdraw' && story.status !== 'withdrawn') patch = { status: 'withdrawn', withdrawn_at: now }
  if (!patch) return NextResponse.json({ error: 'That cannot be done to this story now.' }, { status: 409 })
  const { error } = await admin.from('stories').update(patch).eq('id', story.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Please try again.' }, { status: 500 })
  return NextResponse.json({ status: patch.status })
}
