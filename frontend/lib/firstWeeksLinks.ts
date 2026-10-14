import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The links in the first two weeks' emails (lib/firstWeeks.ts). Server-only.
 *
 * Like the reminders to finish setup (lib/setupReminders.ts), they work
 * without signing in: each carries the account id and a signature made with a
 * server-only secret, so a link cannot be made for someone else's account. A
 * link only stops these emails, or notes that one was opened on the way to a
 * page of the app; it never shows anything.
 */

function key(): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', 'autinerary-first-weeks-v1').update(secret).digest()
}

export function firstWeeksSignature(userId: string): string {
  return createHmac('sha256', key()).update(userId).digest('base64url')
}

export function firstWeeksSignatureMatches(userId: string, signature: string): boolean {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(String(userId || ''))) return false
    const expected = Buffer.from(firstWeeksSignature(userId))
    const given = Buffer.from(String(signature || ''))
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

/** A page of this app to go to after a link: a path on this site, never another site. */
export function safeAppPath(to: unknown): string {
  const path = typeof to === 'string' ? to : ''
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || path.length > 300) return '/path'
  return path
}

export function firstWeeksLinks(appUrl: string, userId: string, day: number): { open: (to: string) => string; stop: string; oneClick: string } {
  const base = appUrl.replace(/\/$/, '')
  const q = `u=${encodeURIComponent(userId)}&t=${encodeURIComponent(firstWeeksSignature(userId))}`
  return {
    open: (to: string) => `${base}/api/emails/first-weeks?${q}&a=open&d=${day}&to=${encodeURIComponent(safeAppPath(to))}`,
    stop: `${base}/emails/first-weeks?${q}`,
    // Mail apps' one-click unsubscribe (List-Unsubscribe-Post).
    oneClick: `${base}/api/emails/first-weeks?${q}&a=stop`,
  }
}

/** Write to the person's firstWeeks choice, reading the saved preferences first so nothing else is lost. */
export async function updateFirstWeeks(admin: SupabaseClient, userId: string, patch: Record<string, unknown>, onlyIfUnset?: string): Promise<void> {
  const { data: row } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  const prefs = (row?.preferences as Record<string, any>) || {}
  const current = (prefs.firstWeeks as Record<string, unknown>) || {}
  if (onlyIfUnset && current[onlyIfUnset]) return
  const { error } = await admin.from('profiles').update({ preferences: { ...prefs, firstWeeks: { ...current, ...patch } } }).eq('id', userId)
  if (error) throw new Error(error.message)
}
