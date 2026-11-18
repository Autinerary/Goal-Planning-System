import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isPlacement, SPONSORED_ON, UUID_RE } from '@/lib/sponsored'
import { validImpressionToken, viewerKeyByIp } from '@/lib/sponsoredToken'
import { clientIp, rateLimited } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse/i

// Clicks counted from one address for one promotion in a day: past this, a
// click isn't sent to be charged at all (several accounts on one address
// can't spend a budget). Events of any kind from one address are capped too.
const CLICKS_PER_ADDRESS_A_DAY = 3
const EVENTS_PER_ADDRESS_10_MINUTES = 120
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * POST /api/sponsored/event { id, kind: 'impression' | 'click', placement, token }:
 * a sponsored listing was seen (half of it on screen) or clicked. Counted
 * once a day per person, under a key that changes daily (lib/sponsoredToken.ts),
 * by STEP 83's promotion_record(), which charges a click its bid and ends a
 * promotion whose budget is spent.
 *
 * Counted only with the token served with the listing (app/api/search/sponsored),
 * for this promotion, place and viewer: a click used to be counted for anyone
 * who posted an id, so a script could spend a business's budget (bug audit,
 * 17 November 2026, item 16).
 */
export async function POST(req: NextRequest) {
  const no = NextResponse.json({ counted: false })
  if (!SPONSORED_ON || BOTS.test(req.headers.get('user-agent') || 'bot')) return no
  const b = await req.json().catch(() => ({}))
  if (!UUID_RE.test(String(b?.id || '')) || !['impression', 'click'].includes(b?.kind) || !isPlacement(b?.placement)) {
    return NextResponse.json({ error: 'Which listing?' }, { status: 400 })
  }
  const ip = clientIp(req.headers)
  if (rateLimited('sponsored-events', ip, EVENTS_PER_ADDRESS_10_MINUTES, 10 * 60_000)) return no
  const {
    data: { user },
  } = await createClient().auth.getUser()
  const userId = user?.id ?? null
  if (!validImpressionToken(b?.token, b.id, b.placement, userId, req.headers)) return no
  if (b.kind === 'click' && rateLimited('sponsored-clicks', `${ip}|${b.id}`, CLICKS_PER_ADDRESS_A_DAY, DAY_MS)) return no
  const { data, error } = await createAdminClient().rpc('promotion_record', {
    p_promotion: b.id,
    p_kind: b.kind,
    p_viewer_key: viewerKeyByIp(userId, req.headers),
    p_placement: b.placement,
  })
  if (error) return no
  return NextResponse.json({ counted: Boolean((data as any)?.counted) })
}
