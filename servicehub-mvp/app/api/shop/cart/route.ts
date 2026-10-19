import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CHECKOUT_ON, canBuyHere } from '@/lib/shop/selling'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The cart (the products round, Goal 9), for products a vendor sells through
 * ResourceHub. Each person's own (cart_items, RLS).
 *
 * GET    /api/shop/cart
 * POST   /api/shop/cart { product_id, variation, quantity }
 * PATCH  /api/shop/cart { id, quantity }
 * DELETE /api/shop/cart { id }
 */
export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ lines: [] })
  const { data: lines } = await supabase.from('cart_items').select('id, product_id, variation, quantity').eq('user_id', user.id).order('added_at')
  const ids = (lines || []).map((l) => l.product_id)
  const { data: products } = ids.length
    ? await supabase.from('products').select('id, name, brand, price, currency, stock, status, vendor_user_id, seller, category').in('id', ids)
    : { data: [] as any[] }
  const byId = new Map((products || []).map((p: any) => [p.id, p]))
  return NextResponse.json({
    checkout: CHECKOUT_ON,
    lines: (lines || []).map((l) => ({ ...l, product: byId.get(l.product_id) || null })),
  })
}

export async function POST(req: NextRequest) {
  if (!CHECKOUT_ON) return NextResponse.json({ error: 'Buying through ResourceHub isn’t on yet.' }, { status: 503 })
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const productId = String(b?.product_id || '')
  if (!UUID.test(productId)) return NextResponse.json({ error: 'Which product?' }, { status: 400 })
  const { data: product } = await supabase.from('products').select('id, price, stock, status, vendor_user_id, variations').eq('id', productId).maybeSingle()
  if (!product || !(await canBuyHere(product as any))) return NextResponse.json({ error: 'This can’t be bought here; see where to get it.' }, { status: 400 })
  const variation: Record<string, string> = {}
  for (const v of ((product as any).variations || []) as { name: string; options: string[] }[]) {
    const pick = b?.variation?.[v.name]
    if (typeof pick === 'string' && v.options.includes(pick)) variation[v.name] = pick
  }
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(b?.quantity) || 1)))
  const { data: existing } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('product_id', productId).eq('variation', variation).maybeSingle()
  const next = Math.min(20, (existing?.quantity || 0) + quantity)
  if (product.stock != null && next > product.stock) return NextResponse.json({ error: `Only ${product.stock} left.` }, { status: 400 })
  const { error } = existing
    ? await supabase.from('cart_items').update({ quantity: next }).eq('id', existing.id)
    : await supabase.from('cart_items').insert({ user_id: user.id, product_id: productId, variation, quantity })
  if (error) return NextResponse.json({ error: 'Could not add that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(b?.quantity) || 1)))
  const { error } = await supabase.from('cart_items').update({ quantity }).eq('id', String(b?.id || '')).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not change that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const { error } = await supabase.from('cart_items').delete().eq('id', String(b?.id || '')).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'Could not remove that.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
