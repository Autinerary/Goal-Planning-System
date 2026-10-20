import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { UUID_RE } from '@/lib/social'
import { step64Missing } from '@/lib/publicProfiles'
import type { FutureNoteKind } from '@/lib/moments'

export const dynamic = 'force-dynamic'

/**
 * Notes to your future self (STEP 87): the Journal's "Quick Note to Self",
 * and the note you write when you stop a task. Each person's own.
 *
 * GET             all of yours, newest first
 * GET ?due=1      the ones waiting to come back to you (on the Task View)
 * POST { kind?, body, task_ref?, task_title?, later? }  later: show it from tomorrow
 * PATCH { id, seen: true }  you've read it where it came back
 * DELETE { id }
 */

const KINDS: FutureNoteKind[] = ['note', 'do_better', 'keep_going', 'remember_today']
const COLS = 'id, kind, body, task_title, show_after, seen_at, created_at'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const due = req.nextUrl.searchParams.get('due') === '1'
  let q = supabase.from('future_notes').select(COLS).eq('user_id', user.id)
  if (due) q = q.is('seen_at', null).lte('show_after', new Date().toISOString())
  const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ available: false, notes: [] })
    return NextResponse.json({ error: 'Your notes could not be loaded.' }, { status: 500 })
  }
  // Due: notes from stopping a task, and quick notes you asked to see again
  // (saved to show later than they were written).
  const notes = (data || []).filter((n: any) => !due || n.kind !== 'note' || new Date(n.show_after).getTime() - new Date(n.created_at).getTime() > 60_000)
  return NextResponse.json({ available: true, notes })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, 1000) : ''
  if (!text) return NextResponse.json({ error: 'Write something first.' }, { status: 400 })
  const kind: FutureNoteKind = KINDS.includes(body?.kind) ? body.kind : 'note'
  // A note from stopping a task comes back the next time, from tomorrow on;
  // a quick note you ask to see again, the next time you open a task.
  const later = body?.later === true || kind !== 'note'
  const delay = kind === 'note' ? 2 * 60_000 : 12 * 3_600_000
  const { data, error } = await supabase
    .from('future_notes')
    .insert({
      user_id: user.id,
      kind,
      body: text,
      task_ref: typeof body?.task_ref === 'string' ? body.task_ref.slice(0, 200) : null,
      task_title: typeof body?.task_title === 'string' ? body.task_title.slice(0, 200) : null,
      show_after: later ? new Date(Date.now() + delay).toISOString() : new Date().toISOString(),
    })
    .select(COLS)
    .single()
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ error: 'Notes to yourself open soon.' }, { status: 503 })
    return NextResponse.json({ error: 'Your note could not be saved. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ note: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a note.' }, { status: 400 })
  const { error } = await supabase.from('future_notes').update({ seen_at: body?.seen === false ? null : new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'That didn’t save.' }, { status: step64Missing(error) ? 503 : 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { body = null }
  const id = typeof body?.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'Choose a note.' }, { status: 400 })
  const { data, error } = await supabase.from('future_notes').delete().eq('id', id).eq('user_id', user.id).select('id')
  if (error) return NextResponse.json({ error: 'That note could not be deleted.' }, { status: step64Missing(error) ? 503 : 500 })
  if (!data?.length) return NextResponse.json({ error: 'That note couldn’t be found.' }, { status: 404 })
  return NextResponse.json({ deleted: id })
}
