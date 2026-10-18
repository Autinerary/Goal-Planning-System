import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS } from '@/lib/billing'
import { CONTACT_EMAIL } from '@/lib/contact'
import { emailEnabled, sendEmail, type BillingFacts } from '@/lib/email'

export type NoticeKind = 'agreement_copy' | 'free_period_ending' | 'free_month_ending' | 'free_month_ended' | 'renewal_notice' | 'payment_failed' | 'cancelled'

export const billingFacts = (): BillingFacts => ({
  appUrl: (process.env.NEXT_PUBLIC_APP_URL || 'https://app.autinerary.ca').replace(/\/$/, ''),
  business: { ...BUSINESS, email: CONTACT_EMAIL, address: BUSINESS.address || process.env.NEWSLETTER_POSTAL_ADDRESS || '' },
})

export const longDate = (d: string | number | Date) =>
  new Date(d).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Toronto' })

/**
 * Sends a billing email once (STEP 81's billing_notices, one row per kind and
 * ref, kept as the record that it went out). Resend's idempotency key covers
 * two deliveries at once; the row covers repeats after that. Nothing is
 * written unless the email was sent.
 */
export async function sendBillingNotice(
  admin: SupabaseClient,
  n: { userId: string; kind: NoticeKind; ref: string; to: string | null | undefined; email: { subject: string; html: string; text: string } }
): Promise<'sent' | 'already' | 'skipped' | 'failed'> {
  if (!emailEnabled() || !n.to) return 'skipped'
  const { data: seen, error } = await admin.from('billing_notices').select('id').eq('kind', n.kind).eq('ref', n.ref).maybeSingle()
  if (error) return 'failed'
  if (seen) return 'already'
  const sent = await sendEmail({ to: n.to, ...n.email, idempotencyKey: `billing-${n.kind}-${n.ref}`.slice(0, 256) })
  if (!sent.ok) {
    console.error('[billing] notice not sent:', n.kind, sent.error)
    return 'failed'
  }
  await admin.from('billing_notices').upsert({ user_id: n.userId, kind: n.kind, ref: n.ref, sent_to: n.to }, { onConflict: 'kind,ref', ignoreDuplicates: true })
  return 'sent'
}

/** The account's email and name, from sign-in (the source of truth). */
export async function personFor(admin: SupabaseClient, userId: string): Promise<{ email: string | null; name: string }> {
  const { data } = await admin.auth.admin.getUserById(userId)
  const u = data?.user
  const name = (u?.user_metadata?.full_name || u?.user_metadata?.name || '').toString().trim()
  return { email: u?.email || null, name: name || u?.email || 'there' }
}
