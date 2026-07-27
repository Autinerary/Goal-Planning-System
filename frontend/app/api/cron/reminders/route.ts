import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, dailyReminderEmail, emailEnabled } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/reminders — daily email reminders.
 *
 * Meant to be hit by an hourly Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer <CRON_SECRET>`; we require it when CRON_SECRET is set.
 *
 * Reads profiles whose preferences.reminders is enabled+consented with
 * channel=email, and emails those whose chosen hour matches this run. NO-OPS
 * until RESEND_API_KEY is set, so it's safe to schedule immediately.
 *
 * Limitation: reminder times have no timezone, so we match on the UTC hour.
 * Per-user timezone handling is a follow-up.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') || ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!emailEnabled()) {
    return NextResponse.json({ ok: true, sent: 0, note: 'RESEND_API_KEY not set — reminder emails are off.' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const currentHour = new Date().getUTCHours()

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, email, preferences')
    .not('preferences', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  let considered = 0
  const failures: string[] = []

  for (const row of rows || []) {
    const rem = (row.preferences as any)?.reminders
    if (!rem?.enabled || !rem?.consent || rem?.channel !== 'email') continue
    const to = (rem.contact as string) || (row.email as string)
    if (!to) continue

    // Match the chosen hour (HH:MM) against this run's UTC hour.
    const hour = parseInt(String(rem.time || '09:00').split(':')[0], 10)
    if (isNaN(hour) || hour !== currentHour) continue

    considered++
    const name = (row.preferences as any)?.name || null
    const { subject, html, text } = dailyReminderEmail(name, appUrl)
    const res = await sendEmail({ to, subject, html, text })
    if (res.ok) sent++
    else if (!res.skipped) failures.push(`${row.id}: ${res.error}`)
  }

  return NextResponse.json({ ok: true, considered, sent, failures: failures.slice(0, 10) })
}
