import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/connections/pending
 * Returns incoming friend requests for the current user:
 *   social_connections rows where target_user_id = me AND status = 'pending'.
 * Joins the requester's profile so the inbox UI can render name/avatar/dream.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('social_connections')
    .select('id, owner_id, category, name, role, status, icon, created_at')
    .eq('target_user_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requesterIds = Array.from(new Set((rows || []).map(r => r.owner_id).filter(Boolean)))
  let profiles: Record<string, any> = {}
  if (requesterIds.length) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_emoji, dream')
      .in('id', requesterIds)
    for (const p of profs || []) profiles[(p as any).id] = p
  }

  // social_connections.name is the label the REQUESTER typed when adding
  // this connection — that is, their name for the recipient. Falling back
  // to it meant a request rendered with the recipient's own name on it,
  // which is what testers reported seeing. If we genuinely cannot read the
  // requester's profile, say so plainly instead of naming the wrong person.
  const pending = (rows || []).map(r => ({
    id: r.id,
    category: r.category,
    requested_at: r.created_at,
    requester: profiles[r.owner_id] || {
      id: r.owner_id,
      display_name: 'Someone on Autinerary',
      avatar_emoji: '👤',
    },
  }))

  return NextResponse.json({ pending })
}
