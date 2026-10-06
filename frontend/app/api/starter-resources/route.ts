import { NextRequest, NextResponse } from 'next/server'
import { isStartGoal } from '@/lib/startHere'
import { starterItems } from '@/lib/starterItems'

/**
 * GET /api/starter-resources?need=<goal id>&for=<role id>
 *
 * The items of a "Start here" pathway (lib/startHere.ts), filled in from
 * ResourceHub's public search: how many places each search finds, and which
 * shop items match. Searches that find nothing are left out. Paths are
 * ResourceHub paths; the page decides how to link them (signed in or not).
 *
 * Public data only. Complete answers are cached for 10 minutes at the edge.
 */

export async function GET(req: NextRequest) {
  const need = req.nextUrl.searchParams.get('need')
  const role = req.nextUrl.searchParams.get('for')
  if (!isStartGoal(need)) return NextResponse.json({ error: 'Unknown need' }, { status: 400 })
  const { items, failed } = await starterItems(role, need)
  return NextResponse.json(
    { items },
    // A partial answer (ResourceHub slow or down) is not kept.
    { headers: { 'Cache-Control': failed ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=3600' } },
  )
}
