import { createHmac, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isEmail } from './requests'

/**
 * "Stop them", in each request Sign me up emails to a local service
 * (lib/requests.ts, STEP 91). Server-only. Like the first weeks' links
 * (lib/firstWeeksLinks.ts), it works without signing in: it carries the
 * address and a signature made with a server-only secret, so a link can only
 * stop emails to the address it was sent to. Stopped addresses go in
 * service_email_optouts (STEP 79), the one list every email to a service
 * checks (the surveys and "you were rated" too), so nothing from Autinerary
 * goes to them again.
 */

function key(): Buffer {
  const secret = process.env.CHECKIN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('No signing secret configured')
  return createHmac('sha256', 'autinerary-request-stop-v1').update(secret).digest()
}

const norm = (email: string) => String(email || '').trim().toLowerCase()

export const requestStopSignature = (email: string): string => createHmac('sha256', key()).update(norm(email)).digest('base64url')

export function requestStopMatches(email: string, signature: string): boolean {
  try {
    if (!isEmail(norm(email))) return false
    const expected = Buffer.from(requestStopSignature(email))
    const given = Buffer.from(String(signature || ''))
    return expected.length === given.length && timingSafeEqual(expected, given)
  } catch {
    return false
  }
}

/** The page the email links to: one button, so a mail app opening the link does nothing by itself. */
export const requestStopUrl = (appUrl: string, email: string): string =>
  `${appUrl.replace(/\/$/, '')}/emails/requests-stop?e=${encodeURIComponent(norm(email))}&t=${encodeURIComponent(requestStopSignature(email))}`

/** Which of these addresses asked Autinerary not to email them. Throws when it can't tell, so nothing goes to one that did. */
export async function stoppedAddresses(admin: SupabaseClient, emails: Array<string | null | undefined>): Promise<Set<string>> {
  const list = [...new Set(emails.filter((e): e is string => !!e).map(norm))]
  if (!list.length) return new Set()
  const { data, error } = await admin.from('service_email_optouts').select('email_key').in('email_key', list)
  if (error) throw new Error(error.message)
  return new Set((data || []).map((r: { email_key: string }) => r.email_key))
}

export async function stopRequestsTo(admin: SupabaseClient, email: string): Promise<void> {
  const { error } = await admin
    .from('service_email_optouts')
    .upsert({ email_key: norm(email), note: '“Stop them”, in a request sent with Sign me up' }, { onConflict: 'email_key', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}
