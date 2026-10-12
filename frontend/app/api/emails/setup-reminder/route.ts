import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { applySetupReminderAction, setupReminderSignatureMatches } from '@/lib/setupReminders'

export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/setup-reminder?u=<account id>&t=<signature>&a=<snooze3|snooze7|stop>
 * (or the same as JSON): "Remind me in 3 days", "in a week" or "Stop these
 * reminders" from a reminder to finish setup (lib/setupReminders.ts). Also the
 * one-click unsubscribe that mail apps send (List-Unsubscribe-Post), so it
 * accepts any body. Works without signing in; the signature ties the link to
 * one account.
 */
export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams
  const body = query.get('u') ? null : await req.json().catch(() => null)
  const userId = String(query.get('u') || body?.u || '')
  const signature = String(query.get('t') || body?.t || '')
  const action = String(query.get('a') || body?.a || 'stop')
  if (!['snooze3', 'snooze7', 'stop'].includes(action)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  if (!setupReminderSignatureMatches(userId, signature)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  try {
    const state = await applySetupReminderAction(createAdminClient(), userId, action as 'snooze3' | 'snooze7' | 'stop')
    return NextResponse.json({ ok: true, until: state.setupReminder?.snoozeUntil || state.setupNudge?.snoozeUntil || null })
  } catch {
    return NextResponse.json({ error: 'Could not change the reminders. Please try again.' }, { status: 500 })
  }
}
