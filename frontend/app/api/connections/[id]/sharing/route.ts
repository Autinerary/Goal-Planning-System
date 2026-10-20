import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * POST /api/connections/:id/sharing { shares?: 'all' | 'progress' | 'none', watch?: boolean }
 *
 * Your side of one connection (Hare World's "Share / Restrict / Private" and
 * "Watch tasks", STEP 87): what they can see of your journey (everything:
 * path, calendar and progress; progress only; or nothing, though you can
 * still message), and whether you're told when they finish a milestone. The
 * database sets only your own side (set_connection_sharing).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Choose a connection.' }, { status: 400 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const shares = ['all', 'progress', 'none'].includes(body?.shares) ? body.shares : null
  const watch = typeof body?.watch === 'boolean' ? body.watch : null
  if (shares === null && watch === null) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 })
  const { data, error } = await supabase.rpc('set_connection_sharing', { p_connection: params.id, p_shares: shares, p_watch: watch })
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'This opens soon.' }, { status: 503 })
    if (error.hint === 'not_found') return NextResponse.json({ error: 'That connection couldn’t be found.' }, { status: 404 })
    return NextResponse.json({ error: 'That didn’t save. Please try again.' }, { status: 500 })
  }
  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({ shares: row?.shares ?? shares, watching: row?.watching ?? watch })
}
