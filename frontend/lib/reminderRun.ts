// The reminder send: run once an hour by Vercel Cron (vercel.json), it sends
// each daily reminder at the time its owner chose, where they live, and the
// reminders to finish setup that someone asked for (up to three, each with
// "finish now, remind me in a few days, or stop"; lib/setupReminders.ts).
// Server-only.
//
// Riipen Labs, Group 11: re-engage "through Autinerary's own channels: email,
// in-app, and push reminders ... Users choose the timing."

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, dailyReminderEmail, finishSetupEmail, setupReminderEmail, storyReadyEmail, emailEnabled } from '@/lib/email'
import { setupReminderLinks } from '@/lib/setupReminders'
import { postalAddress } from '@/lib/newsletter'
import { sendSms, smsEnabled, reminderText } from '@/lib/sms'
import { reminderDue, setupReminderDue, localParts, validTimeZone } from '@/lib/reminderSchedule'
import { isPaused } from '@/lib/pause'
import { cronAuthorized } from '@/lib/cronAuth'

export interface ReminderRunResult {
  ok: true
  considered: number
  sent: number
  texted: number
  setupSent: number
  failures: string[]
  note?: string
}

export async function runReminders(now: Date, appUrl: string): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { ok: true, considered: 0, sent: 0, texted: 0, setupSent: 0, failures: [] }
  if (!emailEnabled() && !smsEnabled()) return { ...result, note: 'Neither email (RESEND_API_KEY) nor texts (TWILIO_*) are set up.' }

  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('profiles').select('id, email, preferences').not('preferences', 'is', null)
  if (error) throw new Error(error.message)

  // Write to one key of preferences, reading it again first so a change made
  // since this run started is kept.
  const patchPreferences = async (id: string, key: string, value: Record<string, unknown>) => {
    const { data: fresh } = await admin.from('profiles').select('preferences').eq('id', id).maybeSingle()
    const prefs = (fresh?.preferences as Record<string, any>) || {}
    await admin.from('profiles').update({ preferences: { ...prefs, [key]: { ...(prefs[key] || {}), ...value } } }).eq('id', id)
  }

  for (const row of rows || []) {
    const prefs = (row.preferences as Record<string, any>) || {}
    // A paused account gets nothing until it is resumed.
    if (isPaused(prefs)) continue

    // The daily reminder, at the hour they chose. reminderState is written
    // only here, so it survives the person changing their settings.
    const rem = prefs.reminders
    const day = reminderDue(rem, prefs.reminderState?.lastSentOn, now)
    if (day) {
      result.considered++
      let sent = false
      if (rem.channel === 'sms') {
        // Texts go only to a number its owner proved is theirs.
        const { data: found } = await admin.auth.admin.getUserById(row.id)
        const phone = found?.user?.app_metadata?.sms_phone as string | undefined
        if (smsEnabled() && phone) {
          const res = await sendSms(phone, reminderText(appUrl))
          if (res.ok) { sent = true; result.texted++ } else result.failures.push(`${row.id}: ${res.error}`)
        }
      } else if (emailEnabled()) {
        const to = (rem.contact as string) || (row.email as string)
        if (to) {
          const { subject, html, text } = dailyReminderEmail(prefs.name || null, appUrl)
          const res = await sendEmail({ to, subject, html, text, idempotencyKey: `reminder-${row.id}-${day}` })
          if (res.ok) { sent = true; result.sent++ } else if (!res.skipped) result.failures.push(`${row.id}: ${res.error}`)
        }
      }
      if (sent) await patchPreferences(row.id, 'reminderState', { lastSentOn: day, channel: rem.channel === 'sms' ? 'sms' : 'email' })
    }

    // Reminders to finish setup, only if asked for on the setup page and
    // only while setup is unfinished (skipping it counts as unfinished): up
    // to three (lib/reminderSchedule.ts, setupReminderDue). An ask saved by
    // the first version gets its one email, the morning after.
    const ask = prefs.setupReminder
    const due = emailEnabled() ? setupReminderDue(ask, now) : null
    if (due) {
      const { data: found } = await admin.auth.admin.getUserById(row.id)
      const account = found?.user
      if (!account) continue
      const send = account.user_metadata?.has_completed_onboarding !== true && Boolean(account.email)
      const sequence = ask.plan === 'sequence'
      if (send) {
        const links = setupReminderLinks(appUrl, row.id)
        const { subject, html, text } = sequence
          ? setupReminderEmail(appUrl, { index: due, audience: ask.audience, links, postal: postalAddress() })
          : finishSetupEmail(appUrl)
        const headers = sequence ? { 'List-Unsubscribe': `<${links.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined
        const res = await sendEmail({ to: account.email!, subject, html, text, headers, idempotencyKey: `setup-reminder-${row.id}-${ask.requestedAt}-${due}` })
        if (!res.ok) {
          if (!res.skipped) result.failures.push(`${row.id}: ${res.error}`)
          continue
        }
        result.setupSent++
      }
      const stamp = now.toISOString()
      await patchPreferences(row.id, 'setupReminder', !send
        ? { closedAt: stamp }
        : sequence ? { sends: [...(ask.sends || []), stamp], snoozeUntil: null } : { sentAt: stamp })
    }
  }
  result.failures = result.failures.slice(0, 10)
  return result
}

/**
 * A shared story whose final version the team has prepared: tell its teller,
 * once, that it is waiting for their approval (app/share-your-story). Quietly
 * does nothing before public.stories exists (STEP 52).
 */
export async function notifyStories(appUrl: string): Promise<number> {
  if (!emailEnabled()) return 0
  const admin = createAdminClient()
  const { data, error } = await admin.from('stories').select('id, user_id').eq('status', 'awaiting_approval').is('notified_at', null).limit(50)
  if (error || !data) return 0
  let sent = 0
  for (const story of data) {
    const { data: found } = await admin.auth.admin.getUserById(story.user_id)
    const to = found?.user?.email
    if (!to) continue
    const res = await sendEmail({ ...storyReadyEmail(appUrl), to, idempotencyKey: `story-ready-${story.id}` })
    if (res.ok) {
      sent++
      await admin.from('stories').update({ notified_at: new Date().toISOString() }).eq('id', story.id)
    }
  }
  return sent
}

/** The UTC hour a run belongs to, for the log. */
export function runLabel(now: Date): string {
  return `${now.toISOString().slice(0, 13)}:00Z (Eastern ${localParts(now, validTimeZone('America/Toronto')).hour}:00)`
}

/** A cron request: checked against CRON_SECRET, then one run. */
export async function handleReminderRun(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const now = new Date()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  try {
    const result = await runReminders(now, appUrl)
    const storiesNotified = await notifyStories(appUrl).catch(() => 0)
    console.log(`[reminders] ${runLabel(now)}`, JSON.stringify({ ...result, failures: result.failures.length, storiesNotified }))
    return NextResponse.json({ ...result, storiesNotified })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'reminder run failed' }, { status: 500 })
  }
}
