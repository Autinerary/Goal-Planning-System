import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, checkinEmail } from '@/lib/email'
import { pushEnabled, pushToUser } from '@/lib/push'
import { createCheckinToken } from '@/lib/checkinToken'
import { AWAY_DAYS } from '@/lib/checkin'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/cron/inactive-checkin  (Vercel cron, daily)
 *
 * Riipen Labs, Group 2: "send a very short survey to inactive users", and
 * "add email and notification opt-in so a check-in can reach users who stop
 * opening the app". Reaches people who
 *   - opted in to the check-in email (profiles.preferences.checkin.optIn,
 *     off by default), or turned on notifications on a device
 *     (public.push_subscriptions, STEP 47), and
 *   - have not opened the app for AWAY_DAYS. Their last activity is the
 *     latest of: the last day they opened the app (checkin_state.last_seen_on),
 *     when they opted in, and when they turned notifications on.
 *
 * Each gets the same one question, by email and/or notification, whichever
 * they chose; both link to /checkin, which works without signing in. One
 * check-in per absence: someone already reached gets another only if they
 * came back after it and then stopped again, and never within 60 days.
 *
 * ?dry=1 reports how many would be reached without sending anything.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; required when set.
 */

const RESEND_GAP_DAYS = 60
const DAY = 86_400_000
const BATCH = 200

interface Person {
  id: string
  email?: string
  /** Opted in to the check-in email, and when. */
  emailSince?: number
  /** Turned notifications on (latest device), and when. */
  pushSince?: number
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && (req.headers.get('authorization') || '') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const dry = req.nextUrl.searchParams.get('dry') === '1'
  const now = Date.now()
  const admin = createAdminClient()
  const people = new Map<string, Person>()

  const { data: optedIn, error } = await admin
    .from('profiles')
    .select('id, email, checkin:preferences->checkin')
    .eq('preferences->checkin->>optIn', 'true')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  for (const p of (optedIn || []) as { id: string; email: string | null; checkin: any }[]) {
    if (!p.email) continue
    people.set(p.id, { id: p.id, email: p.email, emailSince: Date.parse(p.checkin?.updatedAt || '') || 0 })
  }

  // Devices with notifications on. Missing before STEP 47 is applied.
  const { data: devices } = await admin.from('push_subscriptions').select('user_id, created_at')
  for (const d of (devices || []) as { user_id: string; created_at: string }[]) {
    const person = people.get(d.user_id) || { id: d.user_id }
    person.pushSince = Math.max(person.pushSince || 0, Date.parse(d.created_at) || 0)
    people.set(d.user_id, person)
  }

  const counts = {
    optedIn: Array.from(people.values()).filter((p) => p.email).length,
    withNotifications: Array.from(people.values()).filter((p) => p.pushSince).length,
  }
  if (people.size === 0) return NextResponse.json({ ok: true, ...counts, eligible: 0, emailed: 0, notified: 0 })

  const ids = Array.from(people.keys())
  const state = new Map<string, { seen: number; sentAt: number; count: number }>()
  for (let i = 0; i < ids.length; i += BATCH) {
    const { data, error: stateError } = await admin
      .from('checkin_state')
      .select('user_id, last_seen_on, last_sent_at, send_count')
      .in('user_id', ids.slice(i, i + BATCH))
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

  const eligible: (Person & { count: number })[] = []
  for (const p of people.values()) {
    const s = state.get(p.id)
    const lastActive = Math.max(s?.seen || 0, p.emailSince || 0, p.pushSince || 0)
    if (!lastActive || now - lastActive < AWAY_DAYS * DAY) continue
    if (s?.sentAt && (s.sentAt > lastActive || now - s.sentAt < RESEND_GAP_DAYS * DAY)) continue
    eligible.push({ ...p, count: s?.count || 0 })
  }

  if (dry) return NextResponse.json({ ok: true, dry: true, ...counts, eligible: eligible.length })

  const canEmail = emailEnabled()
  const canPush = pushEnabled()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const today = new Date(now).toISOString().slice(0, 10)
  let emailed = 0
  let notified = 0
  const failures: string[] = []
  for (const p of eligible) {
    const token = createCheckinToken(p.id, new Date(now))
    let reached = false
    if (p.email && canEmail) {
      const { subject, html, text } = checkinEmail(appUrl, token)
      const res = await sendEmail({ to: p.email, subject, html, text, idempotencyKey: `checkin-${p.id}-${today}` })
      if (res.ok) {
        emailed++
        reached = true
      } else if (!res.skipped) {
        failures.push(res.error || 'email failed')
      }
    }
    if (p.pushSince && canPush) {
      const sent = await pushToUser(admin, p.id, {
        title: 'One quick question',
        body: "You haven't opened Autinerary for a couple of weeks. Tap to tell us why, it's one question.",
        url: `/checkin?t=${encodeURIComponent(token)}`,
        tag: 'checkin',
      })
      if (sent > 0) {
        notified++
        reached = true
      }
    }
    if (!reached) continue
    await admin.from('checkin_state').upsert({ user_id: p.id, last_sent_at: new Date(now).toISOString(), send_count: p.count + 1 })
  }
  return NextResponse.json({
    ok: true,
    ...counts,
    eligible: eligible.length,
    emailed,
    notified,
    failures: failures.slice(0, 5),
    ...(canEmail ? {} : { note: 'RESEND_API_KEY not set, so check-in emails are off.' }),
  })
}
