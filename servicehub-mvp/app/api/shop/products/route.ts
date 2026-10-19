import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_CATEGORIES } from '@/types/shop'
import { groupOfCategory } from '@/lib/shop/categories'
import { qualitiesForGroup } from '@/lib/shop/qualities'

const httpsUrl = (v: unknown) => {
  if (typeof v !== 'string' || !v.trim()) return null
  try {
    const u = new URL(v.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString().slice(0, 500) : null
  } catch {
    return null
  }
}
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return 'Store'
  }
}

/**
 * POST /api/shop/products: suggest a product (the products round's planning
 * note, Goal 1). It waits as pending (STEP 82: suggestions no longer go live
 * at once); the team checks it on its maker's or seller's pages and makes
 * it live from ResourceHub's admin Requests. The submitter can see their own.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to suggest a product.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const name = String(body.name ?? '').trim()
  const category = String(body.category ?? '').trim().toLowerCase()
  if (name.length < 2 || name.length > 200) return NextResponse.json({ error: 'Give its name (2 to 200 characters).' }, { status: 400 })
  if (!PRODUCT_CATEGORIES.includes(category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 })
  const buy = httpsUrl(body.buy_url)
  if (!buy) return NextResponse.json({ error: 'Add a link to where to get it.' }, { status: 400 })
  const maker = httpsUrl(body.maker_url)

  const priceRaw = body.price === null || body.price === '' || body.price === undefined ? null : Number(body.price)
  if (priceRaw !== null && (!Number.isFinite(priceRaw) || priceRaw < 0 || priceRaw > 100000)) return NextResponse.json({ error: 'The price doesn’t look right.' }, { status: 400 })
  const currency = body.currency === 'USD' ? 'USD' : 'CAD'

  // Only qualities that fit its category (lib/shop/qualities.ts).
  const allowed = new Set(qualitiesForGroup(groupOfCategory(category)).map((q) => q.id))
  const qualities = Array.from(new Set((Array.isArray(body.qualities) ? body.qualities : []).filter((q: unknown) => typeof q === 'string' && allowed.has(q)))).slice(0, 20)

  const row = {
    name,
    brand: String(body.brand ?? '').trim().slice(0, 120) || null,
    description: String(body.description ?? '').trim().slice(0, 1000) || null,
    category,
    price: priceRaw,
    currency,
    price_note: priceRaw === null ? 'Prices vary by store' : 'The price the person who suggested it saw',
    qualities,
    buy_links: [{ label: host(buy), url: buy }],
    maker_url: maker,
    source_type: 'community',
    status: 'pending',
    submitted_by: user.id,
  }
  let { data, error } = await supabase.from('products').insert(row).select('id').single()
  // Before STEP 82 there are no qualities, links or pending status: the old shape, waiting as a draft.
  if (error && /column|status|check/i.test(error.message || '')) {
    ;({ data, error } = await supabase
      .from('products')
      .insert({ name, description: row.description, category, price: priceRaw ?? 0, currency, status: 'draft', submitted_by: user.id, seller: row.brand })
      .select('id')
      .single())
  }
  if (error || !data) {
    console.error('[shop] suggest product failed:', error?.message)
    return NextResponse.json({ error: 'Could not send that just now.' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 })
}
