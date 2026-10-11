import { NextRequest, NextResponse } from 'next/server'
import { stopWeeklyPicks } from '@/lib/weeklyPicks'

export const dynamic = 'force-dynamic'

/**
 * POST /api/emails/weekly-stop?u=<account id>&c=<code> (or { u, c }): turn off
 * the weekly email for people with an account (lib/weeklyPicks.ts). Also the
 * one-click unsubscribe that mail apps send (List-Unsubscribe-Post), so it
 * accepts any body. Works without signing in.
 */
export async function POST(req: NextRequest) {
  const query = req.nextUrl.searchParams
  const body = query.get('u') ? null : await req.json().catch(() => null)
  const userId = query.get('u') || body?.u
  const code = query.get('c') || body?.c
  try {
    const outcome = await stopWeeklyPicks(userId, code)
    if (outcome === 'invalid') return NextResponse.json({ error: 'This link is not valid.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not stop the emails. Please try again.' }, { status: 500 })
  }
}
