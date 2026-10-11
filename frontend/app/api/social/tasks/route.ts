import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { pushToUser } from '@/lib/push'
import { UUID_RE, peopleByIds, socialError, socialMissing } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * Tasks from mentors (Riipen Labs, Group 34; STEP 66). Someone who chose you
 * as their mentor can be sent a small task; they accept it, decline it, or
 * tick it off.
 *
 * GET                               tasks for you, and tasks you suggested
 * POST { mentee, title, note?, due_on? }   suggest one
 * PATCH { id, status }              your answer: accepted, done, declined
 * DELETE { id }                     remove (either of you)
 */

type Row = { id: string; mentor_id: string; mentee_id: string; title: string; note: string | null; due_on: string | null; status: string; created_at: string }

export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data, error } = await supabase.from('mentor_tasks').select('id, mentor_id, mentee_id, title, note, due_on, status, created_at').order('created_at', { ascending: false }).limit(100)
  if (error) {
    if (socialMissing(error)) return NextResponse.json({ available: false, forMe: [], fromMe: [] })
    return NextResponse.json({ error: 'Tasks could not be loaded.' }, { status: 500 })
  }
  const rows = (data || []) as Row[]
  const people = await peopleByIds(supabase, rows.map((r) => (r.mentor_id === user.id ? r.mentee_id : r.mentor_id)))
  const shape = (r: Row) => ({ id: r.id, title: r.title, note: r.note, due_on: r.due_on, status: r.status, created_at: r.created_at })
  return NextResponse.json({
    available: true,
    forMe: rows.filter((r) => r.mentee_id === user.id).map((r) => ({ ...shape(r), from: people[r.mentor_id] })),
    fromMe: rows.filter((r) => r.mentor_id === user.id).map((r) => ({ ...shape(r), to: people[r.mentee_id] })),
  })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const mentee = typeof body?.mentee === 'string' && UUID_RE.test(body.mentee) ? body.mentee : null
  if (!mentee) return NextResponse.json({ error: 'Choose someone.' }, { status: 400 })
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 140) : ''
  if (!title) return NextResponse.json({ error: 'Write the task first.' }, { status: 400 })
  const due = typeof body?.due_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_on) ? body.due_on : null
  const { data, error } = await supabase
    .from('mentor_tasks')
    .insert({ mentor_id: user.id, mentee_id: mentee, title, note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null, due_on: due })
    .select('id')
    .single()
  if (error) {
    const e = socialError(error, 'The task could not be sent. Please try again.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  await pushToUser(createAdminClient(), mentee, {
    title: 'A task from your mentor',
    body: 'Your mentor suggested a small task. Open Hare World to see it.',
    url: '/hare-world?view=people#tasks',
    tag: `task-${data.id}`,
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
  const status = ['accepted', 'done', 'declined', 'suggested'].includes(body?.status) ? body.status : null
  if (!id || !status) return NextResponse.json({ error: 'Choose a task and an answer.' }, { status: 400 })
  const { error } = await supabase.rpc('set_mentor_task_status', { task: id, new_status: status })
  if (error) {
    const e = socialError(error, 'That could not be saved.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  return NextResponse.json({ id, status })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a task.' }, { status: 400 })
  const { data, error } = await supabase.from('mentor_tasks').delete().eq('id', id).select('id')
  if (error) {
    const e = socialError(error, 'That task could not be removed.')
    return NextResponse.json({ error: e.error }, { status: e.status })
  }
  if (!data?.length) return NextResponse.json({ error: 'That task couldn’t be found.' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
