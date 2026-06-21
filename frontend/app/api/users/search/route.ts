import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/search?q=foo
 * Searches discoverable profiles by display_name OR email (case-insensitive).
 * Returns up to 20 results, excludes the calling user.
 * Auth required.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  if (q.length < 2) {
    return NextResponse.json({ results: [], note: 'Type at least 2 characters' })
  }
  // Escape PostgREST `or` filter wildcards
  const safe = q.replace(/[%,]/g, '')
  const pattern = `%${safe}%`

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, avatar_emoji, dream')
    .eq('discoverable', true)
    .neq('id', user.id)
    .or(`display_name.ilike.${pattern},email.ilike.${pattern}`)
    .order('display_name', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also fetch existing connection state so the UI can show "Pending" / "Friends" badges
  const ids = (data || []).map(r => r.id)
  let states: Record<string, string> = {}
  if (ids.length) {
    const { data: rels } = await supabase
      .from('social_connections')
      .select('owner_id, target_user_id, status')
      .or(`and(owner_id.eq.${user.id},target_user_id.in.(${ids.join(',')})),and(target_user_id.eq.${user.id},owner_id.in.(${ids.join(',')}))`)
    for (const r of rels || []) {
      const other = (r as any).owner_id === user.id ? (r as any).target_user_id : (r as any).owner_id
      if (other) states[other] = (r as any).status
    }
  }

  return NextResponse.json({
    results: (data || []).map(r => ({ ...r, connection_state: states[r.id] || null })),
  })
}
