import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanCrisisLines } from '@/lib/groups'
import { step64Missing } from '@/lib/publicProfiles'

export const dynamic = 'force-dynamic'

/**
 * One group, for its leaders and the team (STEP 102; lib/groups.ts).
 *
 * GET                  the safety check's counts for the group (organization_safety_counts): week by week, only once
 *                      the group has 10 members, with 1s and 2s hidden; never words, never who. The database decides
 *                      who may see them, from the caller's own sign-in.
 * PATCH { lines }      the group's own crisis lines (at most 5), for its leaders and the team
 */
const UUID = /^[0-9a-f-]{36}$/i

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which group?' }, { status: 400 })
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data, error } = await supabase.rpc('organization_safety_counts', { p_org: params.id })
  if (error) {
    if (error.code === '42501') return NextResponse.json({ error: 'Only this group’s leaders can see its counts.' }, { status: 403 })
    if (step64Missing(error)) return NextResponse.json({ available: false })
    return NextResponse.json({ error: 'Couldn’t load the counts.' }, { status: 500 })
  }
  return NextResponse.json({ available: true, counts: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) return NextResponse.json({ error: 'Which group?' }, { status: 400 })
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const admin = createAdminClient()
  const [{ data: lead }, { data: isAdmin }] = await Promise.all([
    admin.from('organization_members').select('role').eq('org_id', params.id).eq('user_id', user.id).eq('role', 'leader').maybeSingle(),
    supabase.rpc('is_admin'),
  ])
  if (!lead && isAdmin !== true) return NextResponse.json({ error: 'Only this group’s leaders can change its lines.' }, { status: 403 })
  const body = await req.json().catch(() => ({}))
  const lines = cleanCrisisLines(body?.lines)
  const { error } = await admin.from('organizations').update({ crisis_lines: lines }).eq('id', params.id)
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Groups’ own lines aren’t in the database yet (STEP 102).' }, { status: 409 })
    return NextResponse.json({ error: 'Couldn’t save the lines.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, lines })
}
