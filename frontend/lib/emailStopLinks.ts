import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Stop these emails" for emails sent to someone with an account that had no stop link of their own: the daily
 * reminder (lib/email.ts, dailyReminderEmail) and a vendor's discount event notices (vendorDiscountEventEmail).
 * Canada's anti-spam law asks every one of them for a way to stop, and mail apps offer a one-click unsubscribe
 * (List-Unsubscribe-Post). Like the first two weeks' emails (lib/firstWeeksLinks.ts), a link works without signing
 * in: it carries the account id and a signature made with a server-only secret, one per kind, so nobody can make one
 * for someone else's account, and a link for one kind can't stop another. It never expires. Server-only.
 */

export type StopKind = 'reminders' | 'vendor'

export const STOP_KINDS: StopKind[] = ['reminders', 'vendor']

const LABELS: Record<StopKind, string> = {
  reminders: 'autinerary-daily-reminders-v1',
  vendor: 'autinerary-vendor-emails-v1',
}

export function isStopKind(value: unknown): value is StopKind {
  return typeof value === 'string' && (STOP_KINDS as string[]).includes(value)
}

function key(kind: StopKind): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', LABELS[kind]).update(secret).digest()
}

export function stopSignature(kind: StopKind, userId: string): string {
  return createHmac('sha256', key(kind)).update(userId).digest('base64url')
}

export function stopSignatureMatches(kind: unknown, userId: string, signature: string): boolean {
  try {
    if (!isStopKind(kind) || !/^[0-9a-f-]{36}$/i.test(String(userId || ''))) return false
    const expected = Buffer.from(stopSignature(kind, userId))
    const given = Buffer.from(String(signature || ''))
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

/** The page with the button (`stop`), and the address mail apps post to (`oneClick`). */
export function stopLinks(appUrl: string, kind: StopKind, userId: string): { stop: string; oneClick: string } {
  const base = appUrl.replace(/\/$/, '')
  const q = `k=${kind}&u=${encodeURIComponent(userId)}&t=${encodeURIComponent(stopSignature(kind, userId))}`
  return { stop: `${base}/emails/stop?${q}`, oneClick: `${base}/api/emails/stop?${q}` }
}

/** The mail app's one-click unsubscribe headers for a link from stopLinks. */
export function oneClickHeaders(oneClick: string): Record<string, string> {
  return { 'List-Unsubscribe': `<${oneClick}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
}

/**
 * Stop that kind of email, reading the saved preferences first so nothing else in them is lost: the daily reminder
 * is turned off (as in Settings, under Emails), and a vendor's notices stop being emailed (they still show in their
 * Resource Account).
 */
export async function stopEmails(admin: SupabaseClient, kind: StopKind, userId: string): Promise<void> {
  const { data: row, error: readError } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  if (readError) throw new Error(readError.message)
  const prefs = (row?.preferences as Record<string, any>) || {}
  const at = new Date().toISOString()
  const next = kind === 'reminders'
    ? { ...prefs, reminders: { ...(prefs.reminders || {}), enabled: false, stoppedAt: at } }
    : { ...prefs, vendorEmails: { off: true, updatedAt: at } }
  const { error } = await admin.from('profiles').update({ preferences: next }).eq('id', userId)
  if (error) throw new Error(error.message)
}

/** False once someone stopped a vendor's notice emails (stopEmails, 'vendor'). */
export function vendorEmailsOn(prefs: Record<string, any> | null | undefined): boolean {
  return prefs?.vendorEmails?.off !== true
}
