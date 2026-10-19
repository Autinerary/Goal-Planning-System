import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { adFree, isPlacement, pickPromotion, PAYMENTS_ON, SPONSORED_ON } from '@/lib/sponsored'

export const dynamic = 'force-dynamic'

/**
 * GET /api/search/sponsored?q=&category=&province=&placement=: at most one
 * promotion (Resource Accounts, STEP 81; Tidbits too since STEP 83), chosen
 * only by what the person is looking at: the words searched or the Tidbit's
 * topic, the kind of place and the province (lib/sponsored.ts). None for
 * people who pay or have free access. Off (an empty list) until the team
 * turns sponsored listings on.
 */
export async function GET(req: NextRequest) {
  const none = NextResponse.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } })
  if (!SPONSORED_ON) return none
  const sp = req.nextUrl.searchParams
  const placement = sp.get('placement') || 'search'
  if (!isPlacement(placement) || placement === 'paths') return none
  const {
    data: { user },
  } = await createClient().auth.getUser()
  const db = createAdminClient()
  if (await adFree(db, user?.id ?? null)) return none
  const item = await pickPromotion(db, {
    placement,
    text: (sp.get('q') || '').slice(0, 400),
    categories: (sp.get('category') || '').split(',').slice(0, 5),
    province: sp.get('province') || '',
  })
  return NextResponse.json({ items: item ? [item] : [], adFreeOffer: PAYMENTS_ON }, { headers: { 'Cache-Control': 'no-store' } })
}
