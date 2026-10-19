import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { isShopCategory, qualitiesFor } from '@/lib/shop/taxonomy'
import { step81Missing } from '@/lib/listings'

export const dynamic = 'force-dynamic'

const url = (v: unknown) => {
  if (typeof v !== 'string' || !v.trim()) return null
  try {
    const u = new URL(v.trim())
    return /^https?:$/.test(u.protocol) ? u.toString().slice(0, 500) : null
  } catch {
    return null
  }
}

/**
 * GET  /api/business/products  the products a vendor added, any status
 * POST /api/business/products { name, brand, category, description, price, currency, qualities, buy_url, maker_url, stock }
 *
 * The products round's planning note, Goal 10: a Vendor Account can "upload
 * products (to be rated) & product information & manage inventory". A new
 * product waits for the team (ResourceHub's admin Requests); once it is
 * live, the vendor manages it like any listing they run.
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, category, price, currency, status, stock, created_at')
    .eq('submitted_by', user.id)
    .order('created_at', { ascending: false })
  return NextResponse.json({ products: error ? [] : data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const { data: account, error: accountError } = await supabase.from('resource_accounts').select('kind, organization').eq('user_id', user.id).maybeSingle()
  if (accountError) return NextResponse.json({ error: step81Missing(accountError) ? 'Resource Accounts open soon.' : 'Could not check your account.' }, { status: 503 })
  if (!account || account.kind !== 'product_vendor') return NextResponse.json({ error: 'Make a Resource Account as a product vendor first.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const name = String(b?.name || '').trim().slice(0, 200)
  const category = String(b?.category || '')
  if (name.length < 2) return NextResponse.json({ error: 'Give the product’s name.' }, { status: 400 })
  if (!isShopCategory(category)) return NextResponse.json({ error: 'Choose a category.' }, { status: 400 })
  const buy = url(b?.buy_url)
  if (!buy) return NextResponse.json({ error: 'Add a link to where people can get it.' }, { status: 400 })
  const price = b?.price === null || b?.price === '' || b?.price === undefined ? null : Number(b.price)
  if (price !== null && (!Number.isFinite(price) || price < 0)) return NextResponse.json({ error: 'The price doesn’t look right.' }, { status: 400 })
  const allowed = new Set(qualitiesFor(category).map((q) => q.id))
  const qualities = Array.from(new Set((Array.isArray(b?.qualities) ? b.qualities : []).filter((q: unknown) => typeof q === 'string' && allowed.has(q)))).slice(0, 25)
  const stock = b?.stock === '' || b?.stock == null ? null : Math.max(0, Math.floor(Number(b.stock)))

  const { data, error } = await supabase
    .from('products')
    .insert({
      name,
      brand: String(b?.brand || account.organization || '').trim().slice(0, 120) || null,
      category,
      description: String(b?.description || '').trim().slice(0, 1500) || null,
      price,
      currency: b?.currency === 'USD' ? 'USD' : 'CAD',
      price_note: price === null ? 'Prices vary' : `The price ${account.organization} gave`,
      qualities,
      buy_links: [{ label: account.organization, url: buy }],
      maker_url: url(b?.maker_url) || buy,
      stock: Number.isFinite(stock as number) ? stock : null,
      seller: account.organization,
      source_type: 'vendor',
      status: 'pending',
      submitted_by: user.id,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: step81Missing(error) || /column/.test(error.message) ? 'Adding products opens soon.' : 'Could not add that.' }, { status: 500 })
  return NextResponse.json({ id: data.id, status: 'pending' }, { status: 201 })
}
