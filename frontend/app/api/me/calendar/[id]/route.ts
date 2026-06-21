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

  const completed = typeof body?.completed === 'boolean' ? body.completed : undefined
  if (completed === undefined) {
    return NextResponse.json({ error: 'completed (boolean) required' }, { status: 400 })
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  const update = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  }
  const builder = supabase.from('calendar_tasks').update(update).eq('user_id', user.id)
  const { error } = await (isUuid ? builder.eq('id', id) : builder.eq('client_id', id))

  if (error) {
    console.error('PATCH /api/me/calendar/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
