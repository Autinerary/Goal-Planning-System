import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/friend/[id]
 * Returns a connected friend's profile + path summary + calendar + race progress
 * in a single payload, so the friend-profile view doesn't waterfall requests.
 *
 * The caller MUST be connected to the friend (RLS also enforces this via
 * is_connected_to(), but we double-check at the API layer so we can return a
 * clear 403 instead of an empty result).
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const friendId = (ctx.params?.id || '').trim()
  if (!friendId || !UUID_RE.test(friendId)) {
    return NextResponse.json({ error: 'Invalid friend id' }, { status: 400 })
  }
  if (friendId === user.id) {
    return NextResponse.json({ error: 'Cannot view yourself as a friend' }, { status: 400 })
  }

  // 1. Verify the connection (covers role models and mentors too).
  const { data: conn, error: connErr } = await supabase
    .from('social_connections')
    .select('id, category, status, owner_id, target_user_id')
    .or(
      `and(owner_id.eq.${user.id},target_user_id.eq.${friendId}),and(owner_id.eq.${friendId},target_user_id.eq.${user.id})`
    )
    .in('status', ['connected', 'matched'])
    .limit(1)
    .maybeSingle()
  if (connErr) {
    console.error('GET /api/friend/[id] (connection check) error:', connErr)
    return NextResponse.json({ error: connErr.message }, { status: 500 })
  }
  if (!conn) {
    return NextResponse.json({ error: 'Not connected to this user' }, { status: 403 })
  }

  // 2. Parallel-fetch the friend's profile + path + calendar + progress.
  const [profileRes, pathRes, calendarRes, progressRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, avatar_emoji, dream, email')
      .eq('id', friendId)
      .maybeSingle(),
    supabase
      .from('user_paths')
      .select('path_id, payload, updated_at')
      .eq('user_id', friendId)
      .maybeSingle(),
    supabase
      .from('calendar_tasks')
      .select('id, client_id, day, time, name, duration, priority, source, scenario, completed')
      .eq('user_id', friendId)
      .order('day', { ascending: true })
      .order('time', { ascending: true }),
    supabase
      .from('race_progress')
      .select('milestone_id, kind, completed_at')
      .eq('user_id', friendId),
  ])

  if (profileRes.error) console.error('friend profile fetch:', profileRes.error)
  if (pathRes.error) console.error('friend path fetch:', pathRes.error)
  if (calendarRes.error) console.error('friend calendar fetch:', calendarRes.error)
  if (progressRes.error) console.error('friend progress fetch:', progressRes.error)

  return NextResponse.json({
    friend: {
      id: friendId,
      category: conn.category,
      connection_id: conn.id,
      profile: profileRes.data || null,
      path: pathRes.data?.payload || null,
      path_updated_at: pathRes.data?.updated_at || null,
      calendar: calendarRes.data || [],
      progress: progressRes.data || [],
    },
  })
}
