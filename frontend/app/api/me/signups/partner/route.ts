import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { partnerSignup } from '@/lib/signupPartners'
import { SIGNUP_ON } from '@/lib/signups'
import { accountFor, missingTable, partners, recordSignup, userFrom } from '@/lib/signupServer'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * One-click sign-up with a partner service (lib/signupPartners.ts,
 * docs/partner-signups.md): no form at all. Autinerary sends the person's
 * first and last name and email, signed, to the partner, which creates the
 * account and answers created, exists or verify_email.
 *   POST { service, resourceId? }  ->  { status, detail?, loginUrl? }
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ error: 'Sign me up isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const partner = partners()[String(body?.service || '')]
  if (!partner) return NextResponse.json({ error: 'Not a partner service.' }, { status: 400 })
  const secret = process.env[partner.secretEnv]
  if (!secret) return NextResponse.json({ error: `${partner.name} isn’t connected yet.` }, { status: 503 })

  const admin = createAdminClient()
  const account = await accountFor(admin, user)
  if (account.refusal) return NextResponse.json({ error: account.refusal }, { status: 403 })
  if (!account.details || !account.email) return NextResponse.json({ error: 'Check your details first.', needDetails: true }, { status: 409 })
  const { data: before, error: readError } = await admin.from('service_signups').select('status').eq('user_id', user.id).eq('service', partner.key).maybeSingle()
  if (missingTable(readError)) return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
  if (before && ['signed_up', 'check_email', 'exists'].includes(before.status)) return NextResponse.json({ status: before.status, detail: 'already' })

  const { data: profile } = await admin.from('profiles').select('preferences').eq('id', user.id).maybeSingle()
  const consentedAt = String((profile?.preferences as { signup?: { consentedAt?: string } } | null)?.signup?.consentedAt || new Date().toISOString())
  const resourceId = UUID.test(String(body?.resourceId || '')) ? String(body.resourceId) : null
  const r = await partnerSignup(partner, secret, { requestId: randomUUID(), person: { ...account.details, email: account.email }, consentedAt })
  await recordSignup(admin, { userId: user.id, service: partner.key, resourceId, runner: 'partner', status: r.status, detail: r.detail || null })
  return NextResponse.json(r)
}
