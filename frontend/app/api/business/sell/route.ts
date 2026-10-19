import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SHOP_CHECKOUT_ON } from '@/lib/shopSelling'

export const dynamic = 'force-dynamic'

/** POST /api/business/sell { product_id, on }: sell a product you manage through ResourceHub, or stop (the products round, Goal 9). */
export async function POST(req: NextRequest) {
  if (!SHOP_CHECKOUT_ON) return NextResponse.json({ error: 'Selling through ResourceHub isn’t on yet.' }, { status: 503 })
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const productId = String(b?.product_id || '')
  const { data: owns } = await supabase.rpc('owns_listing', { p_kind: 'product', p_item: productId })
  if (owns !== true) return NextResponse.json({ error: 'You don’t manage this product.' }, { status: 403 })
  const admin = createAdminClient()
  if (b?.on) {
    const { data: acct } = await admin.from('vendor_payment_accounts').select('charges_enabled').eq('user_id', user.id).maybeSingle()
    if (!acct?.charges_enabled) return NextResponse.json({ error: 'Set up getting paid first.' }, { status: 400 })
    const { data: p } = await admin.from('products').select('price').eq('id', productId).maybeSingle()
    if (p?.price == null || Number(p.price) <= 0) return NextResponse.json({ error: 'Give it a price first.' }, { status: 400 })
  }
  const { error } = await admin.from('products').update({ vendor_user_id: b?.on ? user.id : null, updated_at: new Date().toISOString() }).eq('id', productId)
  if (error) return NextResponse.json({ error: 'Could not change that.' }, { status: 500 })
  return NextResponse.json({ ok: true, selling: Boolean(b?.on) })
}
