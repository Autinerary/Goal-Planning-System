import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { step64Missing } from '@/lib/publicProfiles'
import { summarise, type SafetyEvent } from '@/lib/aiSafety'

export const dynamic = 'force-dynamic'

const DAYS = 90

/**
 * GET: what the safety check on the assistant and on agents found and did, counted (STEP 101, ai_safety_events;
 * backend core/moderation.py). The team only (is_admin, and the table's own policy). There are no words or accounts
 * to show: the table has none.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: isAdmin } = await supabase.rpc('is_admin')
  if (isAdmin !== true) return NextResponse.json({ error: 'Team only.' }, { status: 403 })

  const since = new Date(Date.now() - DAYS * 864e5).toISOString()
  const { data, error } = await supabase
    .from('ai_safety_events')
    .select('created_at, surface, direction, severity, category, action, checked_by, hidden')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20000)
  if (error) {
    if (step64Missing(error)) return NextResponse.json({ available: false })
    return NextResponse.json({ error: 'Could not load.' }, { status: 500 })
  }
  return NextResponse.json({ available: true, days: DAYS, summary: summarise((data ?? []) as SafetyEvent[], new Date()) })
}
