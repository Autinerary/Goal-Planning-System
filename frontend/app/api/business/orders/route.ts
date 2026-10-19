import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripeClient } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const NEXT: Record<string, string[]> = { processing: ['shipped', 'cancel'], shipped: ['delivered'], delivered: [] }

/**
 * GET   /api/business/orders  a vendor's orders, with their items and returns
 * PATCH /api/business/orders { id, action: 'shipped' | 'delivered' | 'cancel', tracking_url }
 *
 * The products round, Goal 10: "process orders". Cancelling refunds the
 * buyer in full on the vendor's Stripe account (ResourceHub's fee too).
 */
export async function GET() {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ orders: [] })
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, status, total, currency, platform_fee, created_at, email, shipping_address, tracking_url')
    .eq('vendor_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ orders: [] })
  const ids = (orders || []).map((o) => o.id)
  const [{ data: items }, { data: returns }] = ids.length
    ? await Promise.all([supabase.from('order_items').select('order_id, name, quantity, price, variation').in('order_id', ids), supabase.from('order_returns').select('order_id, status, reason').in('order_id', ids)])
    : [{ data: [] as any[] }, { data: [] as any[] }]
  return NextResponse.json({
    orders: (orders || []).map((o) => ({ ...o, items: (items || []).filter((i: any) => i.order_id === o.id), returns: (returns || []).filter((r: any) => r.order_id === o.id) })),
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select('id, status, vendor_user_id, stripe_payment_intent_id, stripe_account_id').eq('id', String(b?.id || '')).maybeSingle()
  if (!order || order.vendor_user_id !== user.id) return NextResponse.json({ error: 'That order wasn’t found.' }, { status: 404 })
  const action = String(b?.action || '')
  if (!(NEXT[order.status] || []).includes(action)) return NextResponse.json({ error: 'That can’t be done to this order now.' }, { status: 400 })
  const now = new Date().toISOString()
  if (action === 'cancel') {
    const stripe = stripeClient()
    if (!stripe || !order.stripe_payment_intent_id || !order.stripe_account_id) return NextResponse.json({ error: 'Could not refund it here; refund it in Stripe.' }, { status: 503 })
    try {
      await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id, refund_application_fee: true }, { stripeAccount: order.stripe_account_id })
    } catch (e: any) {
      return NextResponse.json({ error: `Stripe didn’t refund it: ${e?.message || 'try again'}` }, { status: 502 })
    }
    await admin.from('orders').update({ status: 'cancelled', cancelled_at: now, updated_at: now }).eq('id', order.id)
    return NextResponse.json({ ok: true, status: 'cancelled' })
  }
  let tracking: string | null = null
  if (action === 'shipped' && b?.tracking_url) {
    try {
      const u = new URL(String(b.tracking_url))
      tracking = /^https?:$/.test(u.protocol) ? u.toString().slice(0, 500) : null
    } catch {}
  }
  await admin
    .from('orders')
    .update(action === 'shipped' ? { status: 'shipped', shipped_at: now, tracking_url: tracking, updated_at: now } : { status: 'delivered', delivered_at: now, updated_at: now })
    .eq('id', order.id)
  return NextResponse.json({ ok: true, status: action })
}
