import { NextResponse } from 'next/server'
import { weeklyPicksAvailable } from '@/lib/weeklyPicks'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/weekly-picks: whether the weekly email can be sent yet (email is
 * set up and NEWSLETTER_POSTAL_ADDRESS is set), so Settings offers it only then.
 */
export async function GET() {
  return NextResponse.json({ available: weeklyPicksAvailable() })
}
