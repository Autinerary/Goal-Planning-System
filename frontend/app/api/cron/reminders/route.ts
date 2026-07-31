import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, dailyReminderEmail, emailEnabled } from '@/lib/email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/reminders — daily email reminders.
 *
 * Meant to be hit once a day by Vercel Cron (see vercel.json). Vercel's
 * Hobby plan only allows crons to run once per day, so this fires at a
 * single fixed UTC hour rather than matching each user's chosen hour.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; we require it when
 * CRON_SECRET is set.
 *
 * Reads profiles whose preferences.reminders is enabled+consented with
 * channel=email, and emails all of them on this daily run. NO-OPS until
 * RESEND_API_KEY is set, so it's safe to schedule immediately.
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

    considered++
    const name = (row.preferences as any)?.name || null
    const { subject, html, text } = dailyReminderEmail(name, appUrl)
    const res = await sendEmail({ to, subject, html, text })
    if (res.ok) sent++
    else if (!res.skipped) failures.push(`${row.id}: ${res.error}`)
  }

  return NextResponse.json({ ok: true, considered, sent, failures: failures.slice(0, 10) })
}
