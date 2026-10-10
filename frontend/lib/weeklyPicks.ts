// The weekly email for people with an account (Riipen Labs, Group 11: for
// people who finished setup, "Your saved resources, plus new picks this
// week"). Server-only. Off by default: people turn it on in Settings → Emails.
//
// Sent on Mondays by the weekly email's run (app/api/cron/newsletter), and,
// like the weekly email without an account, only once
// NEWSLETTER_POSTAL_ADDRESS is set: Canada's anti-spam law (CASL) requires a
// mailing address in it.
//
// The "Stop these emails" link names the account and carries a random code
// kept in its app_metadata, which only the server can write. So the link works
// without signing in, never expires (CASL asks for at least 60 days), and
// cannot be pointed at another account.

import { randomBytes, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, sendEmail, weeklyPicksEmail, type NewsletterLink } from '@/lib/email'
import { postalAddress, tipFor, weeklyLinks } from '@/lib/newsletter'
import { HUB_URL } from '@/lib/starterItems'
import { isStartGoal, isStartRole, suggestedStart } from '@/lib/startHere'

const SIX_DAYS = 6 * 86400000
const SAVED_SHOWN = 3

export function weeklyPicksAvailable(): boolean {
  return emailEnabled() && Boolean(postalAddress())
}

/** Who they are here for and what they need, as Start here answers: a saved Start here path first, then setup's answers. */
export function startFor(prefs: Record<string, any>): { for: string; need: string } {
  const path = prefs.startPath
  if (path && isStartRole(path.for) && isStartGoal(path.need)) return { for: path.for, need: path.need }
  return suggestedStart(
    typeof prefs.audience === 'string' ? prefs.audience : 'unsure',
    Array.isArray(prefs.lookingFor) ? prefs.lookingFor : [],
  )
}

/** Whether this week's email is due: turned on, and none sent in the last six days. */
export function weeklyPicksDue(prefs: Record<string, any>, now: Date): boolean {
  if (prefs.weeklyPicks?.enabled !== true) return false
  const last = Date.parse(prefs.weeklyPicksState?.lastSentAt || '')
  return !(last && now.getTime() - last < SIX_DAYS)
}

export function stopLink(appUrl: string, userId: string, code: string): string {
  return `${appUrl.replace(/\/$/, '')}/emails/weekly-stop?u=${userId}&c=${code}`
}

/** True when `code` is the account's stop code. */
export function stopCodeMatches(stored: unknown, code: unknown): boolean {
  if (typeof stored !== 'string' || typeof code !== 'string' || stored.length < 32) return false
  const a = Buffer.from(stored)
  const b = Buffer.from(code)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The resources someone saved in ResourceHub that they have not marked as
 * done, newest first, counting only listings that are still approved (on 10
 * October 2026, 6 of the 7 saved listings had since been rejected).
 */
async function savedResources(admin: SupabaseClient, userId: string): Promise<{ links: NewsletterLink[]; total: number }> {
  const { data: rows, error } = await admin
    .from('saved_resources')
    .select('resource_id')
    .eq('user_id', userId)
    .or('status.is.null,status.neq.past')
    .order('created_at', { ascending: false })
    .limit(100)
  // Better no email than one that says nothing is saved when something is.
  if (error) throw new Error(error.message)
  const ids: string[] = (rows || []).map((r: any) => r.resource_id).filter(Boolean)
  if (!ids.length) return { links: [], total: 0 }
  const { data: resources, error: namesError } = await admin.from('resources').select('id, name').in('id', ids).eq('status', 'approved')
  if (namesError) throw new Error(namesError.message)
  const names = new Map((resources || []).map((r: any) => [r.id as string, r.name as string]))
  const kept = ids.filter((id) => names.has(id))
  return {
    links: kept.slice(0, SAVED_SHOWN).map((id) => ({ label: names.get(id)!, href: `${HUB_URL}/resources/${id}` })),
    total: kept.length,
  }
}

export interface WeeklyPicksResult {
  considered: number
  sent: number
  failures: string[]
  /** Addresses this run covers, so the weekly email without an account skips them. */
  addresses: Set<string>
}

/** This Monday's emails to everyone with an account who turned them on. */
export async function runWeeklyPicks(now: Date, appUrl: string): Promise<WeeklyPicksResult> {
  const result: WeeklyPicksResult = { considered: 0, sent: 0, failures: [], addresses: new Set() }
  const postal = postalAddress()
  if (!emailEnabled() || !postal) return result

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('profiles')
    .select('id, preferences')
    .eq('preferences->weeklyPicks->>enabled', 'true')
  if (error) throw new Error(error.message)

  const run: Run = { admin, now, appUrl, postal, tip: tipFor(now), picks: new Map() }
  for (const row of rows || []) {
    try {
      const outcome = await sendOne(run, row.id, (row.preferences as Record<string, any>) || {}, result.addresses)
      if (outcome !== 'skipped') result.considered++
      if (outcome === 'sent') result.sent++
    } catch (e: any) {
      result.considered++
      result.failures.push(`${row.id}: ${e?.message || 'failed'}`)
    }
  }
  result.failures = result.failures.slice(0, 10)
  return result
}

interface Run {
  admin: SupabaseClient
  now: Date
  appUrl: string
  postal: string
  tip: string
  /** This week's picks for each kind of person, worked out once. */
  picks: Map<string, NewsletterLink[]>
}

/** One person's email: 'skipped' when none is due, 'sent', or an error thrown. */
async function sendOne(run: Run, userId: string, prefs: Record<string, any>, addresses: Set<string>): Promise<'skipped' | 'sent'> {
  const { admin, now, appUrl } = run
  const { data: found } = await admin.auth.admin.getUserById(userId)
  const account = found?.user
  if (!account?.email) return 'skipped'
  addresses.add(account.email.toLowerCase())
  if (!weeklyPicksDue(prefs, now)) return 'skipped'

  // The stop code, made the first time this person gets the email.
  let code = account.app_metadata?.weekly_stop as string | undefined
  if (!code) {
    code = randomBytes(24).toString('hex')
    const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { ...(account.app_metadata || {}), weekly_stop: code } })
    if (error) throw new Error(error.message)
  }

  const start = startFor(prefs)
  const key = `${start.for}.${start.need}`
  if (!run.picks.has(key)) run.picks.set(key, await weeklyLinks(start.for, start.need, now, appUrl))
  const saved = await savedResources(admin, userId)
  const savedHrefs = new Set(saved.links.map((l) => l.href))
  const { subject, html, text } = weeklyPicksEmail({
    name: typeof prefs.name === 'string' && prefs.name.trim() ? prefs.name.trim() : null,
    saved: saved.links,
    savedTotal: saved.total,
    savedUrl: `${HUB_URL}/my-resources`,
    picks: run.picks.get(key)!.filter((l) => !savedHrefs.has(l.href)),
    tip: run.tip,
    appUrl,
    unsubscribe: stopLink(appUrl, userId, code),
    postal: run.postal,
  })
  const res = await sendEmail({
    to: account.email,
    subject,
    html,
    text,
    from: process.env.NEWSLETTER_FROM_EMAIL || undefined,
    idempotencyKey: `weekly-picks-${userId}-${now.toISOString().slice(0, 10)}`,
    headers: {
      'List-Unsubscribe': `<${appUrl.replace(/\/$/, '')}/api/emails/weekly-stop?u=${userId}&c=${code}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
  if (!res.ok) throw new Error(res.error || 'not sent')

  // weeklyPicksState is written only here, so it survives the person changing their settings.
  const { data: fresh } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  const current = (fresh?.preferences as Record<string, any>) || {}
  await admin.from('profiles').update({ preferences: { ...current, weeklyPicksState: { lastSentAt: now.toISOString() } } }).eq('id', userId)
  return 'sent'
}

/** Turn the weekly email off from its own link: the account id and its stop code. */
export async function stopWeeklyPicks(userId: unknown, code: unknown): Promise<'stopped' | 'invalid'> {
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return 'invalid'
  const admin = createAdminClient()
  const { data: found } = await admin.auth.admin.getUserById(userId)
  if (!found?.user || !stopCodeMatches(found.user.app_metadata?.weekly_stop, code)) return 'invalid'
  const { data: fresh } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  const current = (fresh?.preferences as Record<string, any>) || {}
  if (current.weeklyPicks?.enabled === true) {
    const weeklyPicks = { ...current.weeklyPicks, enabled: false, updatedAt: new Date().toISOString(), stoppedFrom: 'email' }
    const { error } = await admin.from('profiles').update({ preferences: { ...current, weeklyPicks } }).eq('id', userId)
    if (error) throw new Error(error.message)
  }
  return 'stopped'
}
