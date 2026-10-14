import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { firstWeeksSignatureMatches, safeAppPath, updateFirstWeeks } from '@/lib/firstWeeksLinks'

export const dynamic = 'force-dynamic'

/**
 * The links in the first two weeks' emails (lib/firstWeeks.ts, Riipen Labs,
 * Group 15). Work without signing in; the signature ties a link to one
 * account (lib/firstWeeksLinks.ts).
 *
 * GET ?u=&t=&a=open&d=<day>&to=<app path>: notes that a link in one was
 *   opened (the first time only), then goes to that page of the app.
 * POST ?u=&t=&a=stop (or the same as JSON): stops the rest. Also the
 *   one-click unsubscribe that mail apps send (List-Unsubscribe-Post), so it
 *   accepts any body.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const to = safeAppPath(q.get('to'))
  const userId = String(q.get('u') || '')
  if (q.get('a') === 'open' && firstWeeksSignatureMatches(userId, String(q.get('t') || ''))) {
    try {
      await updateFirstWeeks(createAdminClient(), userId, { clicked: new Date().toISOString() }, 'clicked')
    } catch {}
  }
  if (q.get('a') === 'stop') return NextResponse.redirect(new URL(`/emails/first-weeks?${q}`, req.nextUrl.origin), 303)
  return NextResponse.redirect(new URL(to, req.nextUrl.origin), 302)
}

export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams
  const body = query.get('u') ? null : await req.json().catch(() => null)
  const userId = String(query.get('u') || body?.u || '')
  const signature = String(query.get('t') || body?.t || '')
  if (!firstWeeksSignatureMatches(userId, signature)) return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
  try {
    await updateFirstWeeks(createAdminClient(), userId, { enabled: false, stoppedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not stop the emails. Please try again.' }, { status: 500 })
  }
}
