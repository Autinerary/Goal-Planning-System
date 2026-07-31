import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_CATEGORIES, type ProductVariation, type SensoryDetails } from '@/types/shop'

/**
 * POST /api/shop/products — create a product (real catalog, no seeding).
 * The submitter owns the row (RLS: submitted_by = auth.uid()).
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = String(body.name ?? '').trim()
  const category = String(body.category ?? '').trim().toLowerCase()
  const price = Number(body.price)

  if (name.length < 2 || name.length > 200) {
    return NextResponse.json({ error: 'Name must be 2-200 characters' }, { status: 400 })
  }
  if (!PRODUCT_CATEGORIES.includes(category as any)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
  }

  const compareRaw = Number(body.compare_at_price)
  const compare_at_price = Number.isFinite(compareRaw) && compareRaw > price ? compareRaw : null

  const image_urls: string[] = Array.isArray(body.image_urls)
    ? body.image_urls.filter((u: any) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 8)
    : []

  const variations: ProductVariation[] = Array.isArray(body.variations)
    ? body.variations
        .map((v: any) => ({
          name: String(v?.name ?? '').trim(),
          options: Array.isArray(v?.options)
            ? v.options.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 20)
            : [],
        }))
        .filter((v: ProductVariation) => v.name && v.options.length > 0)
        .slice(0, 6)
    : []

  const sensory_details: SensoryDetails = {}
  if (body.sensory_details && typeof body.sensory_details === 'object') {
    for (const k of ['texture', 'sound', 'visual', 'material']) {
      const val = String(body.sensory_details[k] ?? '').trim()
      if (val) sensory_details[k] = val.slice(0, 80)
    }
  }

  const stockRaw = Number(body.stock)
  const stock = Number.isFinite(stockRaw) && stockRaw >= 0 ? Math.floor(stockRaw) : null

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      description: String(body.description ?? '').trim() || null,
      category,
      price,
      compare_at_price,
      currency: String(body.currency ?? 'CAD').trim().toUpperCase().slice(0, 3) || 'CAD',
      image_urls,
      variations,
      sensory_details,
      stock,
      seller: String(body.seller ?? '').trim() || null,
      status: 'active',
      submitted_by: user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[shop] create product failed:', error?.message)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id })
}
