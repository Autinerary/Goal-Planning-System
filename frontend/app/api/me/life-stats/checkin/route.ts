import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { loadAndComputeForUser } from '@/lib/life-stats/loader'

/**
 * POST /api/me/life-stats/checkin
 *
 * Body: { mood: 1..10, note?: string }
 *
 * Upserts today's mood check-in for the user and returns the freshly
 * recomputed life-stats payload so the UI can update without a follow-up
 * GET. One row per (user_id, checkin_date), so editing today's mood is
 * idempotent.
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

  const moodRaw = Number(body?.mood)
  if (!Number.isInteger(moodRaw) || moodRaw < 1 || moodRaw > 10) {
    return NextResponse.json(
      { error: 'mood must be an integer between 1 and 10' },
      { status: 400 }
    )
  }
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null

  const todayDay = new Date().toISOString().slice(0, 10)

  const { error: upsertError } = await supabase
    .from('life_stats_checkins')
    .upsert(
      {
        user_id: user.id,
        checkin_date: todayDay,
        mood: moodRaw,
        note,
      },
      { onConflict: 'user_id,checkin_date' }
    )

  if (upsertError) {
    console.error('POST /api/me/life-stats/checkin upsert error:', upsertError.message)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // Re-run the pipeline so the response reflects the new check-in.
  try {
    const payload = await loadAndComputeForUser(supabase, user.id, new Date())
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('POST /api/me/life-stats/checkin recompute failed:', err?.message ?? err)
    // Check-in was saved; just return success without the recomputed payload.
    return NextResponse.json({ ok: true })
  }
}

export const dynamic = 'force-dynamic'
