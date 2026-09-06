import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * DELETE /api/me/calendar/[id]
 * id may be either the row's uuid OR the client_id string the calendar UI uses.
 */
export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const id = (ctx.params?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const builder = supabase.from('calendar_tasks').delete().eq('user_id', user.id)
  const { error } = await (isUuid ? builder.eq('id', id) : builder.eq('client_id', id))

  if (error) {
    console.error('DELETE /api/me/calendar/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * PATCH /api/me/calendar/[id]
 * Body: { completed?: boolean }
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const id = (ctx.params?.id || '').trim()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Two independent operations share this handler: ticking a task off, and
  // rescheduling it by dragging it on the week grid. Only the fields actually
  // supplied are written, so a drag never silently clears `completed` and a
  // tick never moves the task.
  const completed = typeof body?.completed === 'boolean' ? body.completed : undefined

  const rawDate = typeof body?.scheduled_date === 'string' ? body.scheduled_date.trim() : ''
  const scheduledDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined

  const rawTime = typeof body?.time === 'string' ? body.time.trim() : ''
  const time = /^\d{2}:\d{2}$/.test(rawTime) ? rawTime : undefined

  if (completed === undefined && scheduledDate === undefined && time === undefined) {
    return NextResponse.json(
      { error: 'Supply completed (boolean), and/or scheduled_date (yyyy-mm-dd) + time (HH:MM).' },
      { status: 400 }
    )
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const update: Record<string, unknown> = {}
  if (completed !== undefined) {
    update.completed = completed
    update.completed_at = completed ? new Date().toISOString() : null
  }
  if (scheduledDate !== undefined) {
    update.scheduled_date = scheduledDate
    // Dragging a weekly-recurring task onto a specific date turns it into a
    // one-time task on that date. `day` is kept in sync so the two never
    // disagree about which weekday the task sits on.
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const [y, m, d] = scheduledDate.split('-').map(Number)
    update.day = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  }
  if (time !== undefined) update.time = time
  const builder = supabase.from('calendar_tasks').update(update).eq('user_id', user.id)
  const { error } = await (isUuid ? builder.eq('id', id) : builder.eq('client_id', id))

  if (error) {
    console.error('PATCH /api/me/calendar/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
