import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * POST /api/checkin/seen
 *
 * Records today as the last day this person opened the app, for the
 * inactive-user check-in email (app/api/cron/inactive-checkin). Only for
 * people who opted in to that email; for everyone else it stores nothing.
 * Called at most once a day per browser (lib/checkin.ts, markSeenToday).
 * Always answers 204, so it can never get in the way of a page.
 */

const done = () => new NextResponse(null, { status: 204 })

export async function POST() {
  try {
    const supabase = createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return done()
    const { data: profile } = await supabase
      .from('profiles')
      .select('optIn:preferences->checkin->>optIn')
      .eq('id', user.id)
      .maybeSingle()
    if ((profile as { optIn?: string } | null)?.optIn !== 'true') return done()
    await createAdminClient()
      .from('checkin_state')
      .upsert({ user_id: user.id, last_seen_on: new Date().toISOString().slice(0, 10) })
  } catch {}
  return done()
}
