import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailEnabled, newsletterConfirmEmail, newsletterListEmail, sendEmail } from '@/lib/email'
import { askedFor, cleanEmail, ipHash, listLinks, newToken, postalAddress, SIGNUPS_PER_HOUR } from '@/lib/newsletter'
import { isStartGoal, isStartRole, pathwayTitle } from '@/lib/startHere'

export const dynamic = 'force-dynamic'

const RESEND_CONFIRM_AFTER_MS = 10 * 60 * 1000

/**
 * POST /api/newsletter { email, weekly, sendList, role, need }: ask, without
 * an account, for the weekly email and/or this Start here list by email
 * (Riipen Labs, Group 11). Double opt-in: the address gets one email asking
 * to confirm, and nothing else until it is confirmed (/newsletter/confirm).
 * At most one confirmation every 10 minutes per address, and five sign-ups
 * an hour from one place. The answer never says whether an address was
 * already signed up.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  // A field people never see: only robots fill it in.
  if (body?.website) return NextResponse.json({ ok: true })
  const email = cleanEmail(body?.email)
  if (!email) return NextResponse.json({ error: 'Enter an email address, like you@example.com.' }, { status: 400 })
  const weekly = body?.weekly === true
  const role = isStartRole(body?.role) ? body.role : null
  const need = isStartGoal(body?.need) ? body.need : null
  const sendList = body?.sendList === true && need !== null
  if (!weekly && !sendList) return NextResponse.json({ error: 'Choose what you would like by email.' }, { status: 400 })
  if (!emailEnabled()) return NextResponse.json({ error: 'Email is not available just now.' }, { status: 503 })

  const admin = createAdminClient()
  const table = admin.from('newsletter_subscribers')
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, '')
  const now = new Date()
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null
  const where = ipHash(ip)
  try {
    if (where) {
      const since = new Date(now.getTime() - 3600 * 1000).toISOString()
      const { count } = await admin.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('ip_hash', where).gte('created_at', since)
      if ((count || 0) >= SIGNUPS_PER_HOUR) return NextResponse.json({ error: 'Too many sign-ups from here just now. Please try again later.' }, { status: 429 })
    }
    const key = email.toLowerCase()
    const { data: existing, error: readError } = await table.select('*').eq('email_key', key).maybeSingle()
    if (readError) throw readError
    const asked = askedFor(weekly, sendList, role, need)

    // Confirmed before: what they ask for now starts straight away.
    if (existing?.status === 'confirmed') {
      const patch: Record<string, unknown> = { weekly: existing.weekly || weekly }
      if (sendList) {
        const links = await listLinks(role, need!)
        const title = pathwayTitle(role || 'unsure', need!)
        const start = `${appUrl}/start?for=${role || 'unsure'}&need=${need}`
        const { subject, html, text } = newsletterListEmail(title, links, start, `${appUrl}/newsletter/unsubscribe?t=${existing.token}`, postalAddress())
        const sent = await sendEmail({ to: existing.email, subject, html, text })
        if (sent.ok) Object.assign(patch, { list_sent_at: now.toISOString(), role, need })
      }
      await admin.from('newsletter_subscribers').update(patch).eq('id', existing.id)
      return NextResponse.json({ ok: true })
    }

    // A confirmation was just sent: add to the request, but do not send another.
    const recent = existing?.status === 'pending' && existing.confirm_sent_at && now.getTime() - Date.parse(existing.confirm_sent_at) < RESEND_CONFIRM_AFTER_MS
    if (recent) {
      await admin.from('newsletter_subscribers').update({
        weekly: existing.weekly || weekly,
        send_list: existing.send_list || sendList,
        ...(sendList ? { role, need } : {}),
        consent_text: askedFor(existing.weekly || weekly, existing.send_list || sendList, sendList ? role : existing.role, sendList ? need : existing.need),
      }).eq('id', existing.id)
      return NextResponse.json({ ok: true })
    }

    const token = newToken()
    const { error: writeError } = await admin.from('newsletter_subscribers').upsert({
      email, email_key: key, role, need, weekly, send_list: sendList, status: 'pending', token,
      consent_text: asked, ip_hash: where, confirm_sent_at: now.toISOString(),
      created_at: now.toISOString(), confirmed_at: null, unsubscribed_at: null, list_sent_at: null,
    }, { onConflict: 'email_key' })
    if (writeError) throw writeError
    const { subject, html, text } = newsletterConfirmEmail(`${appUrl}/newsletter/confirm?t=${token}`, asked)
    await sendEmail({ to: email, subject, html, text })
    return NextResponse.json({ ok: true })
  } catch {
    // Most likely STEP 52 is not applied yet.
    return NextResponse.json({ error: 'Email sign-up is not available just now. Please try again later.' }, { status: 503 })
  }
}
