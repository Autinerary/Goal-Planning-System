import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/resources/badges — { resourceIds: string[] }
 *
 * Batched rather than one call per card: a results grid can have dozens of
 * resources, and get_resource_badges() already accepts an array.
 */
export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ badges: {} }) }

  const ids = Array.isArray(body?.resourceIds)
    ? body.resourceIds.filter((x: unknown) => typeof x === 'string').slice(0, 200)
    : []
  if (ids.length === 0) return NextResponse.json({ badges: {} })

  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_resource_badges', { p_resource_ids: ids })
  if (error) {
    console.error('[resources/badges]', error.message)
    return NextResponse.json({ badges: {} })
  }

  // The Trending tier (today bronze, this week silver, this month gold, this
  // year platinum) and "Autinerary's Own" too (the team's notes, October 2026).
  const TIERS = ['bronze', 'silver', 'gold', 'platinum']
  const badges: Record<string, { trending: boolean; trendingTier: string | null; highlyRequested: boolean; rare: boolean; firstParty: boolean }> = {}
  for (const row of data || []) {
    badges[row.resource_id] = {
      trending: Boolean(row.trending),
      trendingTier: TIERS.includes(row.trending_tier) ? row.trending_tier : null,
      highlyRequested: Boolean(row.highly_requested),
      rare: Boolean(row.rare),
      firstParty: Boolean(row.first_party),
    }
  }
  return NextResponse.json({ badges })
}
