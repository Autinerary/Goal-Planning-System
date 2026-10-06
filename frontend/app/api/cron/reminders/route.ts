import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, dailyReminderEmail, finishSetupEmail, emailEnabled } from '@/lib/email'

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
 *
 * The same run sends the one reminder to finish setup that someone asked for
 * on the setup page (preferences.setupReminder, Riipen Labs, Group 11), on
 * the first run at least SETUP_REMINDER_AFTER later: the next morning for
 * anyone in North America who asks in the evening. Only if setup is still
 * unfinished; either way the request is then closed, so it is sent once.
 */
const SETUP_REMINDER_AFTER = 6 * 60 * 60 * 1000
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

  let setupSent = 0
  for (const row of rows || []) {
    const ask = (row.preferences as any)?.setupReminder
    if (!ask?.requestedAt || ask.sentAt || ask.closedAt) continue
    const askedAt = Date.parse(ask.requestedAt)
    if (!Number.isFinite(askedAt) || Date.now() - askedAt < SETUP_REMINDER_AFTER) continue

    const { data: found } = await admin.auth.admin.getUserById(row.id)
    const account = found?.user
    if (!account) continue
    const send = account.user_metadata?.has_completed_onboarding !== true && Boolean(account.email)
    if (send) {
      const { subject, html, text } = finishSetupEmail(appUrl)
      const res = await sendEmail({ to: account.email!, subject, html, text, idempotencyKey: `setup-reminder-${row.id}-${askedAt}` })
      if (!res.ok) {
        if (!res.skipped) failures.push(`${row.id}: ${res.error}`)
        continue
      }
      setupSent++
    }
    // Read again before writing, so a change made since the run started is kept.
    const { data: fresh } = await admin.from('profiles').select('preferences').eq('id', row.id).maybeSingle()
    const prefs = (fresh?.preferences as Record<string, any>) || {}
    if (prefs.setupReminder?.requestedAt !== ask.requestedAt) continue
    const stamp = new Date().toISOString()
    await admin.from('profiles').update({
      preferences: { ...prefs, setupReminder: { ...prefs.setupReminder, ...(send ? { sentAt: stamp } : { closedAt: stamp }) } },
    }).eq('id', row.id)
  }

  return NextResponse.json({ ok: true, considered, sent, setupSent, failures: failures.slice(0, 10) })
}
