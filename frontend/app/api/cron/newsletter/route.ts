import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, newsletterWeeklyEmail, sendEmail, type NewsletterLink } from '@/lib/email'
import { postalAddress, tipFor, weeklyLinks } from '@/lib/newsletter'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/newsletter: the weekly email (Mondays, vercel.json) to
 * everyone who confirmed it. Off until NEWSLETTER_POSTAL_ADDRESS is set, as
 * Canada's anti-spam law requires a mailing address in it. Each email has a
 * one-click unsubscribe (List-Unsubscribe) and is sent at most once in six
 * days per person.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && (req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const postal = postalAddress()
  if (!emailEnabled() || !postal) {
    return NextResponse.json({ ok: true, sent: 0, note: 'Set RESEND_API_KEY and NEWSLETTER_POSTAL_ADDRESS to send the weekly email.' })
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const now = new Date()
  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('newsletter_subscribers')
    .select('id, email, token, role, need, last_sent_at').eq('status', 'confirmed').eq('weekly', true)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const tip = tipFor(now)
  const picks = new Map<string, NewsletterLink[]>()
  let sent = 0
  const failures: string[] = []
  for (const row of rows || []) {
    if (row.last_sent_at && now.getTime() - Date.parse(row.last_sent_at) < 6 * 86400000) continue
    const key = `${row.role || ''}.${row.need || ''}`
    if (!picks.has(key)) picks.set(key, await weeklyLinks(row.role, row.need, now, appUrl))
    const stop = `${appUrl}/newsletter/unsubscribe?t=${row.token}`
    const { subject, html, text } = newsletterWeeklyEmail(picks.get(key)!, tip, stop, postal)
    const res = await sendEmail({
      to: row.email, subject, html, text,
      from: process.env.NEWSLETTER_FROM_EMAIL || undefined,
      idempotencyKey: `weekly-${row.id}-${now.toISOString().slice(0, 10)}`,
      headers: {
        'List-Unsubscribe': `<${appUrl}/api/newsletter/unsubscribe?t=${row.token}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })
    if (res.ok) {
      sent++
      await admin.from('newsletter_subscribers').update({ last_sent_at: now.toISOString() }).eq('id', row.id)
    } else if (!res.skipped) failures.push(`${row.id}: ${res.error}`)
  }
  return NextResponse.json({ ok: true, sent, failures: failures.slice(0, 10) })
}
