import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const ALLOWED_KIND = new Set(['completed', 'hearted'])

/**
 * GET /api/me/progress?kind=completed|hearted (optional)
 * Returns milestone ids the user has completed/hearted.
 */
export async function GET(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const kind = (req.nextUrl.searchParams.get('kind') || '').trim()
  let q = supabase
    .from('race_progress')
    .select('milestone_id, kind, completed_at')
    .eq('user_id', user.id)
  if (kind && ALLOWED_KIND.has(kind)) q = q.eq('kind', kind)

  const { data, error } = await q
  if (error) {
    console.error('GET /api/me/progress error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ progress: data || [] })
}

/**
 * POST /api/me/progress
 * Body: { milestone_id: string, kind?: 'completed'|'hearted' }
 * Upserts by (user_id, milestone_id, kind) — calling twice is a no-op.
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const milestone_id = typeof body?.milestone_id === 'string' ? body.milestone_id.trim().slice(0, 120) : ''
  const kindRaw = typeof body?.kind === 'string' ? body.kind.trim() : 'completed'
  const kind = ALLOWED_KIND.has(kindRaw) ? kindRaw : 'completed'

  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('race_progress')
    .upsert(
      { user_id: user.id, milestone_id, kind },
      { onConflict: 'user_id,milestone_id,kind', ignoreDuplicates: true }
    )

  if (error) {
    console.error('POST /api/me/progress error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/me/progress?milestone_id=...&kind=completed|hearted
 */
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const milestone_id = (req.nextUrl.searchParams.get('milestone_id') || '').trim()
  const kindRaw = (req.nextUrl.searchParams.get('kind') || 'completed').trim()
  const kind = ALLOWED_KIND.has(kindRaw) ? kindRaw : 'completed'
  if (!milestone_id) {
    return NextResponse.json({ error: 'milestone_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('race_progress')
    .delete()
    .eq('user_id', user.id)
    .eq('milestone_id', milestone_id)
    .eq('kind', kind)

  if (error) {
    console.error('DELETE /api/me/progress error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
