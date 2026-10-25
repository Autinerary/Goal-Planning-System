// Server only (never import from client components): sending one-click Apply
// applications (lib/applications.ts, STEP 89). Used by app/api/me/applications
// when someone presses Apply, and by app/api/admin/applications when the team
// adds a listing's email address and what was waiting for it goes out.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { FEEDBACK_EMAIL } from '@/lib/feedback'
import { applicationEmail, cleanDetails, listingEmail, waitingTeamEmail, type ApplicationDetails } from '@/lib/applications'

/** What an application row keeps: exactly what is (or will be) sent. */
export interface Snapshot extends ApplicationDetails {
  replyTo: string
  serviceName: string
}

export const snapshotOf = (details: ApplicationDetails, replyTo: string, serviceName: string): Snapshot => ({ ...details, replyTo, serviceName })

/** Back from the stored JSON; null if it is not a whole snapshot. */
export function readSnapshot(raw: unknown): Snapshot | null {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = cleanDetails(r)
  if (!d.ok || typeof r.replyTo !== 'string' || !r.replyTo) return null
  return { ...d.details, replyTo: r.replyTo, serviceName: typeof r.serviceName === 'string' ? r.serviceName : '' }
}

export const missingTable = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /service_applications|application_details/.test(e.message || ''))

export const applyFrom = (): string | undefined => process.env.APPLY_FROM_EMAIL || process.env.REMINDER_FROM_EMAIL || undefined

export const claimUrlFor = (appUrl: string, resourceId: string): string => `${appUrl.replace(/\/$/, '')}/business?claim=resource:${resourceId}`

/**
 * Email one application to the listing's address (the person gets a blind
 * copy; replies go to them) and record how it went. The row must already be
 * claimed (status 'waiting', updated_at set) so two presses can't send twice.
 */
export async function sendApplication(
  admin: SupabaseClient,
  row: { id: string; details: unknown; updated_at?: string | null },
  resource: { id: string; name: string; contact_info: unknown },
  appUrl: string,
): Promise<{ status: 'sent' | 'failed' | 'waiting'; at: string | null; error?: string }> {
  const to = listingEmail(resource.contact_info)
  const snap = readSnapshot(row.details)
  if (!to) return { status: 'waiting', at: null }
  if (!snap) {
    const error = 'The saved application is incomplete.'
    await admin.from('service_applications').update({ status: 'failed', error, updated_at: new Date().toISOString() }).eq('id', row.id)
    return { status: 'failed', at: null, error }
  }
  const email = applicationEmail({ details: snap, replyTo: snap.replyTo, serviceName: resource.name || snap.serviceName, claimUrl: claimUrlFor(appUrl, resource.id) })
  const res = await sendEmail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    from: applyFrom(),
    replyTo: snap.replyTo,
    bcc: snap.replyTo,
    // The same claim never sends twice, even if this request is retried.
    idempotencyKey: `apply-${row.id}-${row.updated_at ? new Date(row.updated_at).getTime() : 0}`,
  })
  const now = new Date().toISOString()
  if (res.ok) {
    await admin.from('service_applications').update({ status: 'sent', sent_to: to, sent_at: now, email_id: res.id || null, error: null, updated_at: now }).eq('id', row.id)
    return { status: 'sent', at: now }
  }
  const error = res.skipped ? 'Email isn’t set up on this server.' : (res.error || 'Sending failed.').slice(0, 500)
  await admin.from('service_applications').update({ status: 'failed', error, updated_at: now }).eq('id', row.id)
  return { status: 'failed', at: null, error }
}

/** Tell the team, once per service, that an application is waiting for its address. No personal details. */
export async function tellTeamWaiting(admin: SupabaseClient, resource: { id: string; name: string }, appUrl: string): Promise<void> {
  const { count } = await admin
    .from('service_applications')
    .select('id', { count: 'exact', head: true })
    .eq('resource_id', resource.id)
    .eq('status', 'waiting')
  if ((count || 0) !== 1) return
  const note = waitingTeamEmail({ serviceName: resource.name, adminUrl: `${appUrl.replace(/\/$/, '')}/admin/applications`, waiting: 1 })
  await sendEmail({ to: process.env.APPLY_TEAM_TO || FEEDBACK_EMAIL, subject: note.subject, text: note.text, html: `<pre style="font-family:inherit;white-space:pre-wrap">${note.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`, from: applyFrom() })
}
