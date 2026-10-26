import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RECIPES } from '@/lib/signupKit'
import { SIGNUP_ON, cleanDetails, isStatus, type SignupStatus } from '@/lib/signups'
import { cleanExtras, howToRequest, isPlace, listingKey, listingWebsite } from '@/lib/requests'
import { stoppedAddresses } from '@/lib/requestLinks'
import { accountFor, missingTable, partners, recordSignup, saveDetails, serviceForUrl, userFrom } from '@/lib/signupServer'

export const dynamic = 'force-dynamic'

/**
 * One-click sign-up (lib/signups.ts, STEP 90). Off unless
 * NEXT_PUBLIC_ONE_CLICK_SIGNUP=on.
 *
 *   GET  ?ids=<resource uuid>,…   the person's sign-ups, the details they
 *                                 checked once (or a first guess), which of
 *                                 these ResourceHub listings the kit can sign
 *                                 them up for (by the listing's website), and
 *                                 how a request reaches the rest (lib/requests.ts)
 *   PUT  { details }              save the details (their yes to Sign me up)
 *   POST { service, runner, status, detail?, resourceId? }
 *                                 record how a sign-up the extension or an app
 *                                 ran has ended (the server robot and partners
 *                                 record their own). The service can be one a
 *                                 newer extension brings: any well-formed key,
 *                                 and only ever the person's own row.
 *
 * Their own rows only; writes go through the service role after the checks.
 * Nothing about a password ever reaches this route. Signed in with the web
 * app's session, or the phone app's Bearer token.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// What the extension and the apps report; the server robot and partners write their own.
const CLIENT_RUNNERS = new Set(['extension', 'desktop', 'mobile'])

export async function GET(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ on: false })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ on: true, signedIn: false }, { status: 401 })
  const admin = createAdminClient()
  const { data: rows, error } = await admin.from('service_signups').select('service, status, runner, updated_at').eq('user_id', user.id)
  if (missingTable(error)) return NextResponse.json({ on: true, ready: false })

  const ids = [...new Set(String(req.nextUrl.searchParams.get('ids') || '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)))].slice(0, 40)
  // Which listings the kit or a partner signs up for, and how a request reaches the rest.
  const listings: Record<string, string> = {}
  const requests: Record<string, { key: string; how: 'email' | 'form' | 'none'; name: string }> = {}
  if (ids.length) {
    const { data: resources } = await admin.from('resources').select('id, name, category, status, contact_info, source_url, source_type').in('id', ids)
    const onFile = new Map<string, string>()
    for (const r of resources || []) {
      const service = serviceForUrl((r.contact_info as { website?: string } | null)?.website || (r.source_type === 'openstreetmap' ? null : r.source_url))
      if (service) listings[r.id] = service
      // A place (a park, a café) has nothing to sign up for: not "no online way to reach them".
      else if (!isPlace(r.category)) requests[r.id] = { key: listingKey(r.id), how: howToRequest(r), name: r.name }
      if (requests[r.id]?.how === 'email') onFile.set(r.id, String((r.contact_info as { email: string }).email).trim().toLowerCase())
    }
    // An address that asked to stop (lib/requestLinks.ts): their website's form instead, or no way online.
    // (Only what the page shows: sending checks again, and sends nothing when it can't tell.)
    const stopped = onFile.size ? await stoppedAddresses(admin, [...onFile.values()]).catch(() => new Set<string>()) : new Set<string>()
    for (const r of resources || []) {
      if (stopped.has(onFile.get(r.id) || '')) requests[r.id].how = listingWebsite(r) ? 'form' : 'none'
    }
  }
  const account = await accountFor(admin, user)
  const signups: Record<string, { status: SignupStatus; runner: string; at: string }> = {}
  for (const r of rows || []) signups[r.service] = { status: r.status, runner: r.runner, at: r.updated_at }
  return NextResponse.json({
    on: true,
    ready: true,
    refusal: account.refusal,
    email: account.email,
    details: account.details,
    extras: account.extras,
    suggested: account.suggested,
    // Whether a request by a website's form can run (the server robot is on).
    forms: process.env.SIGNUP_ROBOT === 'on',
    // Whether the server robot can sign them up where the extension isn't installed.
    robot: process.env.SIGNUP_ROBOT === 'on',
    // Partner services, which take a sign-up directly (lib/signupPartners.ts): never their address or secret.
    partners: Object.values(partners()).map((p) => ({ key: p.key, name: p.name, hosts: p.hosts })),
    signups,
    listings,
    requests,
  })
}

export async function PUT(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ error: 'Sign me up isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const checked = cleanDetails(body?.details)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })
  // What a request to a local service may also carry (all optional).
  const extras = cleanExtras(body?.details?.extras)
  if (!extras.ok) return NextResponse.json({ error: extras.error }, { status: 400 })
  const error = await saveDetails(createAdminClient(), user.id, checked.details, extras.extras)
  if (error) return NextResponse.json({ error: 'That didn’t save. Try again.' }, { status: 500 })
  return NextResponse.json({ ok: true, details: checked.details, extras: extras.extras })
}

export async function POST(req: NextRequest) {
  if (!SIGNUP_ON) return NextResponse.json({ error: 'Sign me up isn’t switched on.' }, { status: 404 })
  const user = await userFrom(req)
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  // The kit's services, and ones a newer extension or app brings (its own catalog): any well-formed key.
  const service = String(body?.service || '')
  if (!RECIPES[service] && !/^[a-z0-9-]{2,40}$/.test(service)) return NextResponse.json({ error: 'Unknown service.' }, { status: 400 })
  if (!CLIENT_RUNNERS.has(body?.runner)) return NextResponse.json({ error: 'Unknown runner.' }, { status: 400 })
  // "timeout" is reported as a failure that can be tried again.
  const status = body?.status === 'timeout' ? 'failed' : body?.status
  if (!isStatus(status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 })
  const admin = createAdminClient()
  const account = await accountFor(admin, user)
  if (account.refusal) return NextResponse.json({ error: account.refusal }, { status: 403 })
  const resourceId = UUID.test(String(body?.resourceId || '')) ? String(body.resourceId) : null
  const { error } = await recordSignup(admin, { userId: user.id, service, resourceId, runner: body.runner, status, detail: typeof body?.detail === 'string' ? body.detail : null })
  if (error) {
    if (/service_signups/.test(error)) return NextResponse.json({ error: 'Sign me up isn’t ready yet.' }, { status: 503 })
    console.error('signups: could not record:', error)
    return NextResponse.json({ error: 'That didn’t save.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, status })
}
