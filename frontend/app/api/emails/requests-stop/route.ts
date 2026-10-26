import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requestStopMatches, stopRequestsTo } from '@/lib/requestLinks'

export const dynamic = 'force-dynamic'

/**
 * "Stop them", from a request Sign me up emailed to a local service
 * (lib/requestLinks.ts, STEP 91). Works without signing in; the signature
 * ties a link to one address.
 *
 * POST { e, t } (or ?e=&t=): no more emails from Autinerary to that address
 * (service_email_optouts): requests, and our own emails to services.
 */
export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams
  const body = query.get('e') ? null : await req.json().catch(() => null)
  const email = String(query.get('e') || body?.e || '')
  const signature = String(query.get('t') || body?.t || '')
  if (!requestStopMatches(email, signature)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  try {
    await stopRequestsTo(createAdminClient(), email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not stop them. Please try again.' }, { status: 500 })
  }
}
