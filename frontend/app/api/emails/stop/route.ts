import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stopEmails, stopSignatureMatches } from '@/lib/emailStopLinks'

export const dynamic = 'force-dynamic'

/**
 * Stops a kind of email without signing in (lib/emailStopLinks.ts).
 * GET ?k=&u=&t=: goes to the page with the button, so a mail app opening the link does nothing by itself.
 * POST ?k=&u=&t= (or the same as JSON): stops them. Also the one-click unsubscribe mail apps send
 * (List-Unsubscribe-Post), so it accepts any body.
 */
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL(`/emails/stop?${req.nextUrl.searchParams}`, req.nextUrl.origin), 303)
}

export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams
  const body = query.get('u') ? null : await req.json().catch(() => null)
  const kind = query.get('k') || body?.k
  const userId = String(query.get('u') || body?.u || '')
  const signature = String(query.get('t') || body?.t || '')
  if (!stopSignatureMatches(kind, userId, signature)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  try {
    await stopEmails(createAdminClient(), kind, userId)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not stop the emails. Please try again.' }, { status: 500 })
  }
}
