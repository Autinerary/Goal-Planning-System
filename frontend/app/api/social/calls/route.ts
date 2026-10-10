import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { UUID_RE, cleanRoomUrl, newRoomUrl, peopleByIds, socialError, socialMissing } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Calls with your people (Riipen Labs, Group 34: "Mentor call" was a timer
 * with no video; STEP 66). A call is booked for a time with a link to a video
 * room: one the app makes on Jitsi Meet, or one you paste (Zoom, Teams, Meet).
 *
 * GET                               your calls: coming up, and the last 20
 * POST { with, scheduled_at, notes?, room_url? }   book one
 * PATCH { id, status: 'cancelled' | 'completed' }   cancel or mark done
 */

type Row = { id: string; caller_id: string; receiver_id: string; call_type: string; status: string; scheduled_at: string | null; notes: string | null; room_url: string | null; created_at: string }

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('video_calls').select('id, caller_id, receiver_id, call_type, status, scheduled_at, notes, room_url, created_at').order('scheduled_at', { ascending: false }).limit(40)
  if (error) {
    if (socialMissing(error)) return NextResponse.json({ available: false, calls: [] })
    return NextResponse.json({ error: 'Your calls could not be loaded.' }, { status: 500 })
  }
  const rows = (data || []) as Row[]
  const people = await peopleByIds(supabase, rows.map((r) => (r.caller_id === user.id ? r.receiver_id : r.caller_id)))
  return NextResponse.json({
    available: true,
    calls: rows.map((r) => ({
      id: r.id,
      with: people[r.caller_id === user.id ? r.receiver_id : r.caller_id],
      booked_by_me: r.caller_id === user.id,
      status: r.status,
      scheduled_at: r.scheduled_at,
      notes: r.notes,
      room_url: r.room_url,
    })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const other = typeof body?.with === 'string' && UUID_RE.test(body.with) ? body.with : null
  if (!other) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })
  const when = new Date(typeof body?.scheduled_at === 'string' ? body.scheduled_at : '')
  if (isNaN(when.getTime())) return NextResponse.json({ error: 'Choose a day and time.' }, { status: 400 })
  if (when.getTime() < Date.now() - 10 * 60 * 1000) return NextResponse.json({ error: 'Choose a time that hasn’t passed.' }, { status: 400 })
  let room: string | null = null
  if (typeof body?.room_url === 'string' && body.room_url.trim()) {
    room = cleanRoomUrl(body.room_url)
    if (!room) return NextResponse.json({ error: 'A video link starts with https:// and has no spaces.' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('video_calls')
    .insert({
      caller_id: user.id,
      receiver_id: other,
      call_type: body?.call_type === 'peer' ? 'peer' : 'mentor',
      scheduled_at: when.toISOString(),
      notes: typeof body?.notes === 'string' ? body.notes.slice(0, 500) : null,
      room_url: room || newRoomUrl(),
    })
    .select('id, room_url, scheduled_at')
    .single()
  if (error) {
    const e = socialError(error, 'The call could not be booked. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  await pushToUser(createAdminClient(), other, {
    title: 'A call was booked with you',
    body: 'Open Hare World to see when, and the link to join.',
    url: '/hare-world?view=people#calls',
    tag: `call-${data.id}`,
  }).catch(() => 0)
  return NextResponse.json({ call: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  const status = body?.status === 'completed' ? 'completed' : body?.status === 'cancelled' ? 'cancelled' : null
  if (!id || !status) return NextResponse.json({ error: 'Choose a call, and cancel it or mark it done.' }, { status: 400 })
  const { error } = await supabase.rpc('set_call_status', { call: id, new_status: status })
  if (error) {
    const e = socialError(error, 'That could not be saved.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  return NextResponse.json({ id, status })
}
