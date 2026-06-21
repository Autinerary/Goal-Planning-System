import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_STATUS = new Set(['pending', 'viewed', 'accepted', 'dismissed'])

/**
 * PATCH /api/suggestions/[id]
 * Body: { status: 'viewed' | 'accepted' | 'dismissed' }
 * Only the receiver (to_user_id) may update — enforced by RLS too.
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
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid suggestion id' }, { status: 400 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const status = typeof body?.status === 'string' ? body.status.trim() : ''
  if (!status || !ALLOWED_STATUS.has(status)) {
    return NextResponse.json({ error: 'status must be one of pending|viewed|accepted|dismissed' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('service_suggestions')
    .update({ status })
    .eq('id', id)
    .eq('to_user_id', user.id)
    .select('id, status')
    .maybeSingle()

  if (error) {
    console.error('PATCH /api/suggestions/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Suggestion not found or not addressed to you' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, suggestion: data })
}

/**
 * DELETE /api/suggestions/[id]
 * Only the sender (from_user_id) may delete — enforced by RLS too.
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
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid suggestion id' }, { status: 400 })
  }

  const { error } = await supabase
    .from('service_suggestions')
    .delete()
    .eq('id', id)
    .eq('from_user_id', user.id)

  if (error) {
    console.error('DELETE /api/suggestions/[id] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
