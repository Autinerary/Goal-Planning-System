import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripeClient } from '@/lib/shop/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/shop/stripe-webhook: Stripe's notices from vendors' accounts
 * (a Connect endpoint, checked with STRIPE_SHOP_WEBHOOK_SECRET; the products
 * round, Goal 9):
 *
 * - checkout.session.completed, paid: the order and its items (a copy of each
 *   product as it was), stock counted down, those lines taken out of the
 *   cart, and a notice to the vendor. Once per checkout (orders_checkout_once).
 * - account.updated: whether the vendor's account can take payments.
 */
export async function POST(req: NextRequest) {
  const stripe = stripeClient()
  const secret = process.env.STRIPE_SHOP_WEBHOOK_SECRET
  if (!stripe || !secret) return NextResponse.json({ error: 'not set up' }, { status: 503 })
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, req.headers.get('stripe-signature') || '', secret)
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }
  const admin = createAdminClient()
  const account = event.account || null

  try {
    if (event.type === 'account.updated') {
      const a = event.data.object as Stripe.Account
      await admin
        .from('vendor_payment_accounts')
        .update({ charges_enabled: Boolean(a.charges_enabled), payouts_enabled: Boolean(a.payouts_enabled), details_submitted: Boolean(a.details_submitted), updated_at: new Date().toISOString() })
        .eq('stripe_account_id', a.id)
    }
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.metadata?.kind !== 'shop' || s.payment_status !== 'paid' || !account) return NextResponse.json({ received: true })
      const { data: seen } = await admin.from('orders').select('id').eq('stripe_checkout_session_id', s.id).maybeSingle()
      if (seen) return NextResponse.json({ received: true, repeat: true })
      const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100, expand: ['data.price.product'] }, { stripeAccount: account })
      const shipping = (s as any).collected_information?.shipping_details || (s as any).shipping_details || null
      const fee = typeof s.payment_intent === 'string' ? (await stripe.paymentIntents.retrieve(s.payment_intent, {}, { stripeAccount: account })).application_fee_amount || 0 : 0
      const { data: order, error } = await admin
        .from('orders')
        .insert({
          user_id: s.metadata.user_id,
          vendor_user_id: s.metadata.vendor_user_id,
          stripe_account_id: account,
          stripe_checkout_session_id: s.id,
          stripe_payment_intent_id: typeof s.payment_intent === 'string' ? s.payment_intent : null,
          status: 'processing',
          subtotal: (s.amount_subtotal || 0) / 100,
          taxes: (s.total_details?.amount_tax || 0) / 100,
          delivery: (s.total_details?.amount_shipping || 0) / 100,
          total: (s.amount_total || 0) / 100,
          currency: String(s.currency || 'cad').toUpperCase(),
          platform_fee: fee / 100,
          email: s.customer_details?.email || null,
          shipping_address: shipping,
          payment_method: 'card',
          paid_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (error) {
        if (error.code === '23505') return NextResponse.json({ received: true, repeat: true })
        throw new Error(error.message)
      }
      for (const li of items.data) {
        const product = li.price?.product as Stripe.Product | undefined
        const productId = product?.metadata?.product_id || null
        await admin.from('order_items').insert({ order_id: order.id, product_id: productId, name: li.description || product?.name || 'Item', price: (li.price?.unit_amount || 0) / 100, quantity: li.quantity || 1 })
        if (productId) {
          const { data: p } = await admin.from('products').select('stock').eq('id', productId).maybeSingle()
          if (p && p.stock != null) await admin.from('products').update({ stock: Math.max(0, p.stock - (li.quantity || 1)) }).eq('id', productId)
        }
      }
      const cartIds = String(s.metadata.cart_item_ids || '').split(',').filter(Boolean)
      if (cartIds.length) await admin.from('cart_items').delete().in('id', cartIds).eq('user_id', s.metadata.user_id)
      await admin.from('vendor_notifications').upsert(
        { user_id: s.metadata.vendor_user_id, kind: 'order', ref: order.id, title: 'A new order', body: `${items.data.length} item${items.data.length === 1 ? '' : 's'}, ${((s.amount_total || 0) / 100).toFixed(2)} ${String(s.currency || 'cad').toUpperCase()}. Ship it, then mark it shipped.`, link: `${(process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'https://app.autinerary.ca').replace(/\/$/, '')}/business#orders` },
        { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
      )
    }
  } catch (e: any) {
    console.error('[shop-webhook]', event.type, e?.message)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
