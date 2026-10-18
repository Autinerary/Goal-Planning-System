import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/cronAuth'
import { runServiceLoop } from '@/lib/serviceLoop'

/**
 * POST /api/cron/service-loop — the service-adding loop's daily slice
 * (lib/serviceLoop.ts; the team's planning note, October 2026, Goal 1).
 * Adds the places one kind of place in one piece of Ontario has that
 * ResourceHub lacks, for a Spot Guide to review in ResourceHub (/spot-guides).
 *
 * Auth: Vercel Cron's `Authorization: Bearer ${CRON_SECRET}` (lib/cronAuth.ts).
 */
export const maxDuration = 300

async function run(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await runServiceLoop(createAdminClient())
    console.log('[service-loop]', JSON.stringify(result))
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[service-loop] failed:', error?.message || error)
    return NextResponse.json({ error: error?.message || 'failed' }, { status: 500 })
  }
}

export const POST = run
// Vercel Cron calls with GET.
export const GET = run
