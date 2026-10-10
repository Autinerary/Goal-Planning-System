import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * DELETE /api/connections/:id — remove a connection the caller made, or one
 * made to them: declining a request, or removing someone who added them.
 * Only the sender could delete before, so a declined request came back on the
 * next visit while the route said it had worked (Riipen Labs, Group 34:
 * "friend requests not received").
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const id = params.id
  if (!id) {
    return NextResponse.json({ error: 'Missing connection id' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('social_connections')
    .delete({ count: 'exact' })
    .eq('id', id)
    .or(`owner_id.eq.${user.id},target_user_id.eq.${user.id}`)

  if (error) {
    console.error('DELETE /api/connections/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!count) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
