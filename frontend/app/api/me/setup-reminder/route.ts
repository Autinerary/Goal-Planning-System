import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { applySetupReminderAction, type SetupReminderAction } from '@/lib/setupReminders'
import { validTimeZone } from '@/lib/reminderSchedule'

export const dynamic = 'force-dynamic'

const ACTIONS = new Set<SetupReminderAction>(['ask', 'cancel', 'snooze3', 'snooze7', 'stop', 'clicked'])
const AUDIENCES = new Set(['self', 'child', 'family', 'friend', 'work', 'ally', 'unsure'])

/**
 * GET /api/me/setup-reminder: the signed-in person's reminders to finish
 * setup, and the in-app card's state (lib/setupReminders.ts).
 * POST { action, timeZone?, audience? }: ask for them, cancel, snooze for 3
 * or 7 days, stop, or record that setup was opened from an email.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await supabase.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
  const prefs = (data?.preferences as Record<string, any>) || {}
  return NextResponse.json({ setupReminder: prefs.setupReminder || null, setupNudge: prefs.setupNudge || null, email: user.email || null })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const action = body?.action as SetupReminderAction
  if (!ACTIONS.has(action)) return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  if (action === 'ask' && !user.email) return NextResponse.json({ error: 'No email address on this account' }, { status: 400 })
  try {
    const state = await applySetupReminderAction(supabase as any, user.id, action, {
      timeZone: typeof body?.timeZone === 'string' ? validTimeZone(body.timeZone) : undefined,
      audience: AUDIENCES.has(body?.audience) ? body.audience : null,
    })
    return NextResponse.json(state)
  } catch {
    return NextResponse.json({ error: 'Could not save that just now' }, { status: 500 })
  }
}
