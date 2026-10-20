import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { tryPushToUser } from '@/lib/push'
import { UUID_RE, connectedPeople, peopleByIds, socialError, socialMissing } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Messages and notes of support between connected people (Riipen Labs,
 * Group 34; STEP 66). The database decides who may read and send.
 *
 * GET               your conversations, newest first, with unread counts,
 *                   and everyone you can message
 * GET ?with=<id>    one conversation, oldest first; marks it read
 * GET ?notes=1      notes of support you were sent, newest first
 * POST { to, content, kind? }   send ('message' or 'support')
 * DELETE { id }     unsend a message you sent
 */

type Row = { id: string; sender_id: string; receiver_id: string; content: string; kind?: string; created_at: string; read_at: string | null }

async function signedIn() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const other = req.nextUrl.searchParams.get('with')
  const notes = req.nextUrl.searchParams.get('notes') === '1'

  if (other) {
    if (!UUID_RE.test(other)) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })
    const [a, b] = await Promise.all([
      supabase.from('messages').select('id, sender_id, receiver_id, content, kind, created_at, read_at').eq('sender_id', user.id).eq('receiver_id', other).order('created_at', { ascending: false }).limit(200),
      supabase.from('messages').select('id, sender_id, receiver_id, content, kind, created_at, read_at').eq('sender_id', other).eq('receiver_id', user.id).order('created_at', { ascending: false }).limit(200),
    ])
    const error = a.error || b.error
    if (error) {
      if (socialMissing(error)) return NextResponse.json({ available: false, messages: [] })
      return NextResponse.json({ error: 'The conversation could not be loaded.' }, { status: 500 })
    }
    const rows = [...((a.data || []) as Row[]), ...((b.data || []) as Row[])].sort((x, y) => x.created_at.localeCompare(y.created_at)).slice(-200)
    if (rows.some((r) => r.receiver_id === user.id && !r.read_at)) await supabase.rpc('mark_conversation_read', { other })
    const people = await peopleByIds(supabase, [other])
    return NextResponse.json({
      available: true,
      person: people[other],
      messages: rows.map((r) => ({ id: r.id, from_me: r.sender_id === user.id, content: r.content, kind: r.kind || 'message', created_at: r.created_at, read_at: r.read_at })),
    })
  }

  if (notes) {
    const { data, error } = await supabase.from('messages').select('id, sender_id, content, created_at, read_at').eq('receiver_id', user.id).eq('kind', 'support').order('created_at', { ascending: false }).limit(20)
    if (error) {
      if (socialMissing(error)) return NextResponse.json({ available: false, notes: [] })
      return NextResponse.json({ error: 'Your notes could not be loaded.' }, { status: 500 })
    }
    const rows = (data || []) as Row[]
    const people = await peopleByIds(supabase, rows.map((r) => r.sender_id))
    return NextResponse.json({ available: true, notes: rows.map((r) => ({ id: r.id, from: people[r.sender_id], content: r.content, created_at: r.created_at, read_at: r.read_at })) })
  }

  // Conversations: the newest 500 messages you sent or got, grouped by person.
  const { data, error } = await supabase.from('messages').select('id, sender_id, receiver_id, content, kind, created_at, read_at').order('created_at', { ascending: false }).limit(500)
  if (error) {
    if (socialMissing(error)) return NextResponse.json({ available: false, conversations: [], people: await connectedPeople(supabase, user.id) })
    return NextResponse.json({ error: 'Your messages could not be loaded.' }, { status: 500 })
  }
  const byPerson = new Map<string, { last: Row; unread: number }>()
  for (const r of (data || []) as Row[]) {
    const person = r.sender_id === user.id ? r.receiver_id : r.sender_id
    const entry = byPerson.get(person) || { last: r, unread: 0 }
    if (r.receiver_id === user.id && !r.read_at) entry.unread++
    byPerson.set(person, entry)
  }
  const people = await peopleByIds(supabase, Array.from(byPerson.keys()))
  return NextResponse.json({
    available: true,
    conversations: Array.from(byPerson.entries()).map(([id, { last, unread }]) => ({
      person: people[id],
      last: { content: last.content, kind: last.kind || 'message', from_me: last.sender_id === user.id, created_at: last.created_at },
      unread,
    })),
    people: await connectedPeople(supabase, user.id),
  })
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const to = typeof body?.to === 'string' && UUID_RE.test(body.to) ? body.to : null
  const content = typeof body?.content === 'string' ? body.content : ''
  const kind = body?.kind === 'support' ? 'support' : 'message'
  if (!to) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: to, content, kind })
    .select('id, content, kind, created_at')
    .single()
  if (error) {
    const e = socialError(error, 'Your message could not be sent. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }

  // On any device they turned notifications on for; never names the sender.
  await tryPushToUser(to, kind === 'support'
    ? { title: 'A note of support', body: 'Someone you’re connected to sent you a note of support.', url: `/hare-world/messages?with=${user.id}`, tag: 'support-note' }
    : { title: 'New message', body: 'You have a new message in Hare World.', url: `/hare-world/messages?with=${user.id}`, tag: `message-${user.id}` }
  )

  return NextResponse.json({ message: { id: data.id, from_me: true, content: data.content, kind: data.kind, created_at: data.created_at, read_at: null } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await signedIn()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a message.' }, { status: 400 })
  const { data, error } = await supabase.from('messages').delete().eq('id', id).eq('sender_id', user.id).select('id')
  if (error) {
    const e = socialError(error, 'That message could not be unsent.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That message couldn’t be found.' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
