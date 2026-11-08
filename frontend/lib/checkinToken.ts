import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Signed links for the email check-in. Server-only.
 *
 * Someone who stopped using the app is unlikely to sign in just to answer one
 * question, so the email links to /checkin?t=<token>. The token names the
 * account and the day it was issued, signed with a key derived from the
 * service-role key (already a server-only secret, so no new one to manage).
 * It cannot be forged or pointed at another account, and expires after 30
 * days, except for stopping the emails, which works for a year (Canada's
 * anti-spam law asks for at least 60 days).
 */

const MAX_AGE_DAYS = 30
export const STOP_MAX_AGE_DAYS = 365

function key(): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', 'autinerary-checkin-v1').update(secret).digest()
}

function sign(payload: string): string {
  return createHmac('sha256', key()).update(payload).digest('base64url')
}

export function createCheckinToken(userId: string, now: Date = new Date()): string {
  const payload = `${userId}.${now.toISOString().slice(0, 10)}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

/** The user id the token was issued for, or null if forged, malformed or expired. */
export function verifyCheckinToken(token: string, now: Date = new Date(), maxAgeDays: number = MAX_AGE_DAYS): string | null {
  try {
    const [encoded, signature] = String(token || '').split('.')
    if (!encoded || !signature) return null
    const payload = Buffer.from(encoded, 'base64url').toString()
    const expected = Buffer.from(sign(payload))
    const given = Buffer.from(signature)
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
    const [userId, issued] = payload.split('.')
    if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^\d{4}-\d{2}-\d{2}$/.test(issued)) return null
    const ageDays = (now.getTime() - Date.parse(`${issued}T00:00:00Z`)) / 86_400_000
    // Measured from the start of the issue day, so valid through day 30.
    if (ageDays < 0 || Math.floor(ageDays) > maxAgeDays) return null
    return userId
  } catch {
    return null
  }
}

/**
 * Turn the check-in email off for the account a token names (the email's "Stop these emails", and the mail app's
 * one-click unsubscribe: app/api/checkin, app/api/checkin/stop). False if the token isn't valid.
 */
export async function stopCheckinEmails(admin: SupabaseClient, token: string, now: Date = new Date()): Promise<boolean> {
  const userId = verifyCheckinToken(token, now, STOP_MAX_AGE_DAYS)
  if (!userId) return false
  const { data: profile, error } = await admin.from('profiles').select('preferences').eq('id', userId).maybeSingle()
  if (error || !profile) throw new Error('Could not update your settings')
  const preferences = { ...((profile.preferences as Record<string, unknown>) || {}), checkin: { optIn: false, updatedAt: now.toISOString() } }
  const { error: updateError } = await admin.from('profiles').update({ preferences }).eq('id', userId)
  if (updateError) throw new Error('Could not update your settings')
  return true
}
