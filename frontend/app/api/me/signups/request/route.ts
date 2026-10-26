import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { mapFields } from '@/lib/formMapper'
import { robotBrowser } from '@/lib/signupBrowser'
import { SIGNUP_KIT_SOURCE } from '@/lib/signupKitSource'
import { robotContact } from '@/lib/signupRobot'
import { SIGNUP_ON } from '@/lib/signups'
import { REQUEST_DAILY_LIMIT, emailFoundOnline, formMessage, formSubject, howToRequest, listingEmail, listingKey, listingWebsite, pickSiteEmail, requestEmail } from '@/lib/requests'
import { requestStopUrl, stoppedAddresses } from '@/lib/requestLinks'
import { postalAddress } from '@/lib/newsletter'
import { accountFor, missingTable, recordSignup, userFrom } from '@/lib/signupServer'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Sign me up for a local service (lib/requests.ts, STEP 91): the person's
 * request goes to the service, which replies to them.
 *   - It has an email address: Autinerary emails it (replies go to the
 *     person; they get a blind copy).
 *   - It only has a website: the server robot fills in the website's contact
 *     or booking form (lib/signupRobot.ts robotContact); the AI may read the
 *     form's words (lib/formMapper.ts), never the person's. Needs SIGNUP_ROBOT=on.
 *     Where there's no form it can send (none, a robot check, a question only
 *     they can answer), the request is emailed to the address the website
 *     shows, if one is clearly the service's own (pickSiteEmail).
 *   - Neither: nothing to do online (400).
 * Never to an address that asked Autinerary to stop (service_email_optouts, lib/requestLinks.ts).
 *   POST { resourceId }  ->  { status: requested | needs_you | failed, how, detail?, url?, mapping? }
 *     needs_you: their form, where the person finishes it (with the extension, it
 *     opens there filled in, using `mapping`, the AI's reading of its boxes).
 *   POST { resourceId, sentByThem: true }  ->  { status: requested }
 *     "I've sent it": they finished a handed-over form themselves.
 * One request per person per listing; REQUEST_DAILY_LIMIT a day.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ error: 'Sign me up isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const resourceId = String(body?.resourceId || '')
  if (!UUID.test(resourceId)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })

  const admin = createAdminClient()
  const account = await accountFor(admin, user)
  if (account.refusal) return NextResponse.json({ error: account.refusal }, { status: 403 })
  if (!account.details || !account.email) return NextResponse.json({ error: 'Check your details first.', needDetails: true }, { status: 409 })
  const { data: resource } = await admin.from('resources').select('id, name, category, status, contact_info, source_url, source_type').eq('id', resourceId).maybeSingle()
  if (!resource) return NextResponse.json({ error: 'No such service.' }, { status: 404 })
  const how = howToRequest(resource)
  const robotOn = process.env.SIGNUP_ROBOT === 'on'
  if (how === 'none') return NextResponse.json({ error: 'There’s no online way to reach them yet.', how }, { status: 400 })
  if (how === 'form' && !robotOn) return NextResponse.json({ error: 'Requests through a website’s form aren’t switched on yet.', how }, { status: 409 })

  const key = listingKey(resourceId)
  const { data: before, error: readError } = await admin.from('service_signups').select('status, runner, updated_at').eq('user_id', user.id).eq('service', key).maybeSingle()
  if (missingTable(readError)) return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
  if (before?.status === 'requested') return NextResponse.json({ status: 'requested', how, detail: 'already' })
  // "I've sent it": a form handed over to them, which they finished on the service's own page.
  if (body?.sentByThem === true) {
    if (before?.status !== 'needs_you') return NextResponse.json({ error: 'Nothing is waiting for you there.' }, { status: 409 })
    const saved = await recordSignup(admin, { userId: user.id, service: key, resourceId, runner: before.runner === 'extension' ? 'extension' : 'form', status: 'requested', detail: 'sent_by_them' })
    if (saved.error) return NextResponse.json({ error: 'That didn’t save. Try again.' }, { status: 500 })
    return NextResponse.json({ status: 'requested', how: before.runner, detail: 'sent_by_them' })
  }
  // Still going (a second click, or another tab): not twice.
  if (before?.status === 'started' && Date.now() - new Date(before.updated_at).getTime() < 120_000) return NextResponse.json({ error: 'That request is already on its way.' }, { status: 409 })
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  // Every request counts, whatever ran it (the server, or a hand-over finished in the extension).
  const { count } = await admin.from('service_signups').select('id', { count: 'exact', head: true }).eq('user_id', user.id).like('service', 'r-%').gte('updated_at', since)
  if ((count || 0) >= REQUEST_DAILY_LIMIT) return NextResponse.json({ error: 'That’s the most requests for one day. Try again tomorrow.' }, { status: 429 })

  const onFile = how === 'email' ? listingEmail(resource) : null
  const website = listingWebsite(resource)
  // Nothing goes to an address that asked to stop; if that can't be checked, nothing goes.
  const stopped = async (email: string) => (await stoppedAddresses(admin, [email])).has(email)
  let onFileStopped = false
  try {
    onFileStopped = !!onFile && (await stopped(onFile))
  } catch {
    return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
  }
  if (onFileStopped && !(website && robotOn)) return NextResponse.json({ error: 'They’ve asked not to get requests by email. Call them, or visit their website.', how }, { status: 409 })

  const input = { ...account.details, email: account.email, extras: account.extras, serviceName: resource.name }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/$/, '')
  const mail = async (to: string, fromWebsite: boolean) => {
    const m = requestEmail({ ...input, fromWebsite, stopUrl: requestStopUrl(appUrl, to), postal: postalAddress() })
    return sendEmail({
      to,
      subject: m.subject,
      html: m.html,
      text: m.text,
      from: process.env.APPLY_FROM_EMAIL || process.env.REMINDER_FROM_EMAIL || undefined,
      replyTo: account.email!,
      bcc: account.email!,
      idempotencyKey: `request-${user.id}-${key}-${createHash('sha256').update(to).digest('hex').slice(0, 16)}`,
    })
  }

  let runner: 'email' | 'form' = onFile && !onFileStopped ? 'email' : 'form'
  // Nothing goes unless it's on record first: a request that can't be recorded could be sent twice.
  const started = await recordSignup(admin, { userId: user.id, service: key, resourceId, runner, status: 'started' })
  if (started.error) {
    console.error('request: could not record:', started.error)
    return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
  }
  let status: 'requested' | 'needs_you' | 'failed' = 'failed'
  let detail: string | null = null
  let url: string | undefined
  let mapping: Record<string, string> | undefined

  if (runner === 'email') {
    // An address found on their website (lib/contactLookup.ts) says so, like one the robot found there.
    const sent = await mail(onFile!, emailFoundOnline(resource))
    if (sent.ok) status = 'requested'
    else detail = sent.skipped ? 'Email isn’t set up on this server.' : 'The email didn’t go. Try again.'
  } else {
    const b = await robotBrowser().catch((e) => { console.error('request robot: no browser:', e?.message); return null })
    if (!b) detail = 'The robot couldn’t start.'
    else {
      try {
        const r = await robotContact(b, SIGNUP_KIT_SOURCE, website!, { firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.extras.phone, message: formMessage(input), subject: formSubject(input) }, { map: mapFields, timeoutMs: 70000 })
        if (r.status === 'requested') {
          status = 'requested'
          detail = r.detail || null
        } else {
          // No form it could send: the address their website shows, if one is clearly theirs.
          const pick = pickSiteEmail(r.emails, { name: resource.name, website })
          const usable = pick && pick !== onFile && !(await stopped(pick).catch(() => true)) ? pick : null
          if (usable) {
            runner = 'email'
            const sent = await mail(usable, true)
            if (sent.ok) {
              status = 'requested'
              detail = `website_email:${usable}`
            } else detail = sent.skipped ? 'Email isn’t set up on this server.' : 'The email didn’t go. Try again.'
          } else {
            status = r.status === 'needs_you' ? 'needs_you' : 'failed'
            detail = r.status === 'timeout' ? 'Their website took too long.' : r.detail === 'No contact form on their website.' ? 'No contact form or email address on their website.' : r.detail || null
            url = r.url
            mapping = r.status === 'needs_you' ? r.mapping : undefined
          }
        }
      } catch (e) {
        console.error('request robot:', (e as Error)?.message)
        detail = 'Something went wrong on their website.'
      } finally {
        await b.close().catch(() => {})
      }
    }
  }
  await recordSignup(admin, { userId: user.id, service: key, resourceId, runner, status, detail })
  return NextResponse.json({ status, how: runner, detail, ...(url ? { url } : {}), ...(mapping ? { mapping } : {}) })
}
