import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { loadAndComputeForUser } from '@/lib/life-stats/loader'

/**
 * GET /api/me/life-stats
 *
 * Computes the user's Mentality / Happiness / Focus / Energy scores from
 * the last 7 days of activity, upserts today's snapshot, and returns the
 * trend arrow against the snapshot from 7 days ago.
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

  try {
    // ?tz= is the browser's time zone, for "today"; without it, the one saved with their reminders, or Eastern.
    const tz = req.nextUrl.searchParams.get('tz') || undefined
    const payload = await loadAndComputeForUser(supabase, user.id, new Date(), tz)
    return NextResponse.json(payload)
  } catch (err: any) {
    console.error('GET /api/me/life-stats failed:', err?.message ?? err)
    return NextResponse.json({ error: 'Failed to compute life stats' }, { status: 500 })
  }
}

// Always run this fresh — the snapshot upsert is part of the response.
export const dynamic = 'force-dynamic'
