import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabase } from '@/lib/supabase/server'
import { adFree, pickPromotion, SPONSORED_ON } from '@/lib/sponsored'
import { PAYMENTS_ON } from '@/lib/billing'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sponsored?q=: the one sponsored service a step of someone's plan
 * may show among its suggested services (the Tidbits round's planning note,
 * Goal 7: "in Paths, 1 of 3 recommended resources 'Promoted'"), chosen only
 * by the step's own words (lib/sponsored.ts). None for people who pay or
 * have free access; off until the team turns sponsored listings on.
 */
export async function GET(req: NextRequest) {
  const none = NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } })
  if (!SPONSORED_ON) return none
  const {
    data: { user },
  } = await createServerSupabase().auth.getUser()
  const db = createAdminClient()
  if (await adFree(db, user?.id ?? null)) return none
  const item = await pickPromotion(db, { placement: 'paths', text: (req.nextUrl.searchParams.get('q') || '').slice(0, 400) })
  return NextResponse.json({ items: item ? [item] : [], adFreeOffer: PAYMENTS_ON }, { headers: { 'Cache-Control': 'no-store' } })
}
