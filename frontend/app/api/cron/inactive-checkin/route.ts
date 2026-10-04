import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, checkinEmail } from '@/lib/email'
import { createCheckinToken } from '@/lib/checkinToken'
import { AWAY_DAYS } from '@/lib/checkin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/inactive-checkin  (Vercel cron, daily)
 *
 * Riipen Labs, Group 2: "send a very short survey to inactive users". Emails
 * one question to people who
 *   - opted in (profiles.preferences.checkin.optIn, off by default), and
 *   - have not opened the app for AWAY_DAYS. Their last activity is the later
 *     of the last day they opened the app (checkin_state.last_seen_on) and
 *     when they opted in.
 *
 * One email per absence: someone who was already emailed gets another only
 * if they came back after it and then stopped again, and never within 60
 * days of the last one.
 *
 * ?dry=1 reports how many would be emailed without sending anything.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; required when set.
 * Sends nothing until RESEND_API_KEY is configured.
 */

const RESEND_GAP_DAYS = 60
const DAY = 86_400_000

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && (req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const now = Date.now()
  const admin = createAdminClient()

  const { data: optedIn, error } = await admin
    .from('profiles')
    .select('id, email, checkin:preferences->checkin')
    .eq('preferences->checkin->>optIn', 'true')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const people = (optedIn || []).filter((p) => p.email) as { id: string; email: string; checkin: any }[]
  if (people.length === 0) return NextResponse.json({ ok: true, optedIn: 0, eligible: 0, sent: 0 })

  const state = new Map<string, { seen: number; sentAt: number; count: number }>()
  for (let i = 0; i < people.length; i += 200) {
    const { data, error: stateError } = await admin
      .from('checkin_state')
      .select('user_id, last_seen_on, last_sent_at, send_count')
      .in('user_id', people.slice(i, i + 200).map((p) => p.id))
    if (stateError) return NextResponse.json({ error: stateError.message }, { status: 500 })
    for (const r of data || []) {
      state.set(r.user_id as string, {
        // A day they opened the app counts as active until that day ends.
        seen: r.last_seen_on ? Date.parse(`${r.last_seen_on}T00:00:00Z`) + DAY : 0,
        sentAt: r.last_sent_at ? Date.parse(r.last_sent_at as string) : 0,
        count: (r.send_count as number) || 0,
      })
    }
  }

  const eligible: { id: string; email: string; count: number }[] = []
  for (const p of people) {
    const s = state.get(p.id)
    const optedInAt = Date.parse(p.checkin?.updatedAt || '') || 0
    const lastActive = Math.max(s?.seen || 0, optedInAt)
    if (!lastActive || now - lastActive < AWAY_DAYS * DAY) continue
    if (s?.sentAt && (s.sentAt > lastActive || now - s.sentAt < RESEND_GAP_DAYS * DAY)) continue
    eligible.push({ id: p.id, email: p.email, count: s?.count || 0 })
  }

  if (dry) return NextResponse.json({ ok: true, dry: true, optedIn: people.length, eligible: eligible.length })
  if (!emailEnabled()) {
    return NextResponse.json({ ok: true, optedIn: people.length, eligible: eligible.length, sent: 0, note: 'RESEND_API_KEY not set, so check-in emails are off.' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
  const today = new Date(now).toISOString().slice(0, 10)
  let sent = 0
  const failures: string[] = []
  for (const p of eligible) {
    const { subject, html, text } = checkinEmail(appUrl, createCheckinToken(p.id, new Date(now)))
    const res = await sendEmail({ to: p.email, subject, html, text, idempotencyKey: `checkin-${p.id}-${today}` })
    if (!res.ok) {
      if (!res.skipped) failures.push(res.error || 'send failed')
      continue
    }
    sent++
    await admin.from('checkin_state').upsert({ user_id: p.id, last_sent_at: new Date(now).toISOString(), send_count: p.count + 1 })
  }
  return NextResponse.json({ ok: true, optedIn: people.length, eligible: eligible.length, sent, failures: failures.slice(0, 5) })
}
