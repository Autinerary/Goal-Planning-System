import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const SPONSORED_ON = process.env.NEXT_PUBLIC_SPONSORED === 'on'

/**
 * GET /api/search/sponsored?q=&category=&province=: at most one promotion
 * for a search (Resource Accounts, STEP 81), chosen only by what was
 * searched: its words, the kind of place and the province. Nothing about the
 * person is used. Off (an empty list) until the team turns sponsored
 * listings on, after changing the privacy page, which says we don't show ads.
 */
export async function GET(req: NextRequest) {
  if (!SPONSORED_ON) return NextResponse.json({ items: [] })
  const q = (req.nextUrl.searchParams.get('q') || '').toLowerCase().slice(0, 200)
  const category = (req.nextUrl.searchParams.get('category') || '').toLowerCase()
  const province = (req.nextUrl.searchParams.get('province') || '').toUpperCase()
  const words = new Set(q.split(/[^a-z0-9']+/).filter((w) => w.length > 2))
  if (!words.size && !category) return NextResponse.json({ items: [] })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  const db = createAdminClient()
  const { data } = await db
    .from('promotions')
    .select('id, item_id, headline, body, image_url, categories, keywords, provinces, starts_on, ends_on')
    .eq('status', 'active')
    .eq('item_kind', 'resource')
    .limit(200)
  const live = (data || []).filter(
    (p) =>
      (!p.starts_on || p.starts_on <= today) &&
      (!p.ends_on || p.ends_on >= today) &&
      (!p.provinces?.length || !province || p.provinces.includes(province)) &&
      ((p.keywords || []).some((k: string) => k.split(/\s+/).every((w) => words.has(w))) || (category && (p.categories || []).map((c: string) => c.toLowerCase()).includes(category)))
  )
  if (!live.length) return NextResponse.json({ items: [] })
  const pick = live[Math.floor(Math.random() * live.length)]
  const { data: place } = await db.from('resources').select('id, name, category, location, status').eq('id', pick.item_id).maybeSingle()
  if (!place || place.status !== 'approved') return NextResponse.json({ items: [] })
  return NextResponse.json(
    { items: [{ id: pick.id, headline: pick.headline, body: pick.body, image_url: pick.image_url, resource: { id: place.id, name: place.name, category: place.category, city: (place.location as any)?.city || '' } }] },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
