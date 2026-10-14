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
import { sendEmail, dailyReminderEmail, finishSetupEmail, setupReminderEmail, storyReadyEmail, emailEnabled, firstWeeksEmail } from '@/lib/email'
import { setupReminderLinks } from '@/lib/setupReminders'
import { firstWeeksDue, type FirstWeeksFacts } from '@/lib/firstWeeks'
import { firstWeeksLinks } from '@/lib/firstWeeksLinks'
import { createCheckinToken } from '@/lib/checkinToken'
import { milestoneNames } from '@/lib/pathMilestones'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  /** The first two weeks' emails sent this run (lib/firstWeeks.ts). */
  firstWeeksSent: number
  failures: string[]
  note?: string
}

export async function runReminders(now: Date, appUrl: string): Promise<ReminderRunResult> {
  const result: ReminderRunResult = { ok: true, considered: 0, sent: 0, texted: 0, setupSent: 0, firstWeeksSent: 0, failures: [] }
  if (!emailEnabled() && !smsEnabled()) return { ...result, note: 'Neither email (RESEND_API_KEY) nor texts (TWILIO_*) are set up.' }

  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('profiles').select('id, email, created_at, preferences').not('preferences', 'is', null)
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
    // The emails for their first two weeks, on day 1, 7 and 14, only if asked
    // for (lib/firstWeeks.ts; Riipen Labs, Group 15: "tied to what the user
    // actually did").
    const fw = prefs.firstWeeks
    const fwDay = emailEnabled() ? firstWeeksDue(fw, (row.created_at as string) || null, now) : null
    if (fwDay && row.email) {
      const facts = await firstWeeksFacts(admin, row.id, row.created_at as string, prefs)
      const links = firstWeeksLinks(appUrl, row.id, fwDay)
      const checkin = fwDay === 14 ? `${appUrl.replace(/\/$/, '')}/checkin?t=${encodeURIComponent(createCheckinToken(row.id, now))}&q=useful` : undefined
      const { subject, html, text } = firstWeeksEmail(fwDay, facts, { ...links, checkin }, postalAddress())
      const headers = { 'List-Unsubscribe': `<${links.oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
      const res = await sendEmail({ to: row.email as string, subject, html, text, headers, idempotencyKey: `first-weeks-${row.id}-${fwDay}` })
      if (res.ok) {
        result.firstWeeksSent++
        await patchPreferences(row.id, 'firstWeeks', { sent: { ...(fw.sent || {}), [`day${fwDay}`]: now.toISOString() } })
      } else if (!res.skipped) result.failures.push(`${row.id}: ${res.error}`)
    }
  }
  result.failures = result.failures.slice(0, 10)
  return result
}

/**
 * What someone did since they joined, for the first two weeks' emails. Each
 * part is read on its own; one that cannot be read is left out of the email
 * rather than said as 0.
 */
export async function firstWeeksFacts(admin: SupabaseClient, userId: string, joined: string, prefs: Record<string, any>): Promise<FirstWeeksFacts> {
  const facts: FirstWeeksFacts = { goal: null, nextStep: null, stepsDone: 0, stepsTotal: 0, savedPlaces: 0, daysOpened: 0, journalEntries: 0, audience: typeof prefs.audience === 'string' ? prefs.audience : null }
  const since = joined || new Date(0).toISOString()
  try {
    const { data: paths } = await admin.from('user_paths').select('payload, is_active, updated_at').eq('user_id', userId)
      .order('is_active', { ascending: false }).order('updated_at', { ascending: false }).limit(1)
    const payload = paths?.[0]?.payload as any
    const goals = payload?.userProfile?.goals || payload?.goals
    if (Array.isArray(goals) && typeof goals[0] === 'string' && goals[0].trim()) facts.goal = goals[0].trim().slice(0, 120)
    const steps = Array.from(milestoneNames(payload).entries())
    const { data: progress } = await admin.from('race_progress').select('milestone_id, kind').eq('user_id', userId)
    const done = new Set((progress || []).filter((r: any) => (r.kind || 'completed') === 'completed').map((r: any) => String(r.milestone_id)))
    facts.stepsTotal = steps.length
    facts.stepsDone = steps.filter(([id]) => done.has(id)).length
    const next = steps.find(([id]) => !done.has(id))
    facts.nextStep = next ? { id: next[0], name: next[1].slice(0, 120) } : null
  } catch {}
  try {
    const { count } = await admin.from('saved_resources').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since)
    facts.savedPlaces = count || 0
  } catch {}
  try {
    const { data: opens } = await admin.from('onboarding_events').select('created_at').eq('user_id', userId).eq('event', 'app_open').gte('created_at', since).limit(200)
    facts.daysOpened = new Set((opens || []).map((e: any) => String(e.created_at).slice(0, 10))).size
  } catch {}
  try {
    const { count } = await admin.from('reflections').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since)
    facts.journalEntries = count || 0
  } catch {}
  return facts
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
