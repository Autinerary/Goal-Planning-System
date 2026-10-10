import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { UUID_RE, peopleByIds, socialError, socialMissing } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Goals worked on together (Riipen Labs, Group 34: "Collab" on races had
 * nothing behind it; STEP 66). Invite a connection to one of your goals; they
 * accept or decline. Together, each of you can see the other's progress (as
 * connected people always could) and cheer it on.
 *
 * GET                            invitations and goals together
 * POST { partner, goal, note? }  invite
 * PATCH { id, accept }           answer an invitation
 * DELETE { id }                  leave or withdraw (either of you)
 */

type Row = { id: string; owner_id: string; partner_id: string; goal: string; note: string | null; status: string; created_at: string; responded_at: string | null }

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('race_collabs').select('id, owner_id, partner_id, goal, note, status, created_at, responded_at').neq('status', 'declined').order('created_at', { ascending: false }).limit(50)
  if (error) {
    if (socialMissing(error)) return NextResponse.json({ available: false, collabs: [] })
    return NextResponse.json({ error: 'Goals together could not be loaded.' }, { status: 500 })
  }
  const rows = (data || []) as Row[]
  const people = await peopleByIds(supabase, rows.map((r) => (r.owner_id === user.id ? r.partner_id : r.owner_id)))
  return NextResponse.json({
    available: true,
    collabs: rows.map((r) => ({
      id: r.id,
      goal: r.goal,
      note: r.note,
      status: r.status,
      mine: r.owner_id === user.id,
      with: people[r.owner_id === user.id ? r.partner_id : r.owner_id],
      created_at: r.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const partner = typeof body?.partner === 'string' && UUID_RE.test(body.partner) ? body.partner : null
  const goal = typeof body?.goal === 'string' ? body.goal.trim().slice(0, 200) : ''
  if (!partner) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })
  if (!goal) return NextResponse.json({ error: 'Choose a goal.' }, { status: 400 })
  const { data, error } = await supabase
    .from('race_collabs')
    .insert({ owner_id: user.id, partner_id: partner, goal, note: typeof body?.note === 'string' ? body.note.slice(0, 300) : null })
    .select('id')
    .single()
  if (error) {
    const e = socialError(error, 'The invitation could not be sent. Please try again.')
    return NextResponse.json({ error: e.status === 409 ? 'You already invited them to this goal.' : e.error }, { status: e.status })
  }
  await pushToUser(createAdminClient(), partner, {
    title: 'Work on a goal together?',
    body: 'Someone you’re connected to invited you to a goal. Open Hare World to answer.',
    url: '/hare-world?view=people#together',
    tag: `collab-${data.id}`,
  }).catch(() => 0)
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id || typeof body?.accept !== 'boolean') return NextResponse.json({ error: 'Choose an invitation and an answer.' }, { status: 400 })
  const { error } = await supabase.rpc('respond_race_collab', { collab: id, accept: body.accept })
  if (error) {
    const e = socialError(error, 'That could not be saved.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  return NextResponse.json({ id, status: body.accept ? 'accepted' : 'declined' })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a goal.' }, { status: 400 })
  const { data, error } = await supabase.from('race_collabs').delete().eq('id', id).select('id')
  if (error) {
    const e = socialError(error, 'That could not be removed.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That couldn’t be found.' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
