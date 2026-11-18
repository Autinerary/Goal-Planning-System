import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { stripeClient } from '@/lib/shop/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Admin = ReturnType<typeof createAdminClient>

// How many times to retry a stock change when someone else changed the same
// product's stock between our read and our write.
const STOCK_TRIES = 5

/**
 * Take `qty` from a product's stock, never below zero, with compare-and-swap:
 * the write applies only if the stock is still what was read, and is retried
 * when it moved. Two orders at once used to read the same stock and both write
 * "stock minus mine", losing one (bug audit, 17 November 2026). Returns how
 * much was taken (0 for a product without a stock count, or none left).
 */
async function takeStock(admin: Admin, productId: string, qty: number): Promise<number> {
  for (let attempt = 0; attempt < STOCK_TRIES; attempt++) {
    const { data: p, error } = await admin.from('products').select('stock').eq('id', productId).maybeSingle()
    if (error) throw new Error(`stock read: ${error.message}`)
    if (!p || p.stock == null) return 0
    const n = Number(p.stock)
    const next = Math.max(0, n - qty)
    if (next === n) return 0
    const { data: changed, error: writeError } = await admin.from('products').update({ stock: next }).eq('id', productId).eq('stock', n).select('id')
    if (writeError) throw new Error(`stock write: ${writeError.message}`)
    if (changed && changed.length > 0) return n - next
  }
  throw new Error('stock kept changing')
}

/** Put back what takeStock took, when the order line it was for couldn't be saved. Best effort. */
async function returnStock(admin: Admin, productId: string, qty: number): Promise<void> {
  if (qty <= 0) return
  try {
    for (let attempt = 0; attempt < STOCK_TRIES; attempt++) {
      const { data: p } = await admin.from('products').select('stock').eq('id', productId).maybeSingle()
      if (!p || p.stock == null) return
      const n = Number(p.stock)
      const { data: changed } = await admin.from('products').update({ stock: n + qty }).eq('id', productId).eq('stock', n).select('id')
      if (changed && changed.length > 0) return
    }
  } catch {}
  console.error('[shop-webhook] stock not returned for product', productId, 'qty', qty)
}

/**
 * POST /api/shop/stripe-webhook: Stripe's notices from vendors' accounts
 * (a Connect endpoint, checked with STRIPE_SHOP_WEBHOOK_SECRET; the products
 * round, Goal 9):
 *
 * - checkout.session.completed, paid: the order and its items (a copy of each
 *   product as it was), stock counted down, those lines taken out of the
 *   cart, and a notice to the vendor. Once per checkout (orders_checkout_once).
 * - account.updated: whether the vendor's account can take payments.
 *
 * Any failure answers 500, so Stripe sends the notice again, and a repeat
 * picks up where the last try stopped: the order is marked done (paid_at)
 * only after everything else is saved, each order line is saved once, and a
 * line's stock is taken only when its line is saved. It used to mark the
 * order seen first and ignore later failures, so a failed try left a
 * half-written order that a repeat never finished (bug audit, 17 November 2026).
 */
/** An unfinished order older than this was left by a delivery that stopped (this route can't run for so long). */
const RESUME_AFTER_MS = 5 * 60 * 1000
export const maxDuration = 60

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
      const { error } = await admin
        .from('vendor_payment_accounts')
        .update({ charges_enabled: Boolean(a.charges_enabled), payouts_enabled: Boolean(a.payouts_enabled), details_submitted: Boolean(a.details_submitted), updated_at: new Date().toISOString() })
        .eq('stripe_account_id', a.id)
      if (error) throw new Error(`account: ${error.message}`)
    }
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.metadata?.kind !== 'shop' || s.payment_status !== 'paid' || !account) return NextResponse.json({ received: true })
      const { data: seen, error: seenError } = await admin.from('orders').select('id, paid_at, created_at').eq('stripe_checkout_session_id', s.id).maybeSingle()
      if (seenError) throw new Error(`order read: ${seenError.message}`)
      // Done before: paid_at is set last, once everything below is saved.
      if (seen?.paid_at) return NextResponse.json({ received: true, repeat: true })
      // Started but not finished: another delivery may still be saving it (Stripe can send a notice twice at once).
      // Only one that started well past this route's time limit has stopped for good, so only then does this one
      // pick it up; until then Stripe is asked to try again later, so lines and stock are never taken twice.
      if (seen && Date.now() - Date.parse(String(seen.created_at)) < RESUME_AFTER_MS) {
        throw new Error('this checkout is being saved by another delivery')
      }
      const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100, expand: ['data.price.product'] }, { stripeAccount: account })
      const shipping = (s as any).collected_information?.shipping_details || (s as any).shipping_details || null
      const fee = typeof s.payment_intent === 'string' ? (await stripe.paymentIntents.retrieve(s.payment_intent, {}, { stripeAccount: account })).application_fee_amount || 0 : 0

      // The order, or the one a failed try already started.
      let orderId: string | null = seen?.id ?? null
      if (!orderId) {
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
            // paid_at is set at the end, when the order is complete.
          })
          .select('id')
          .single()
        if (error) {
          // Another delivery of this notice is saving it right now: Stripe will try again.
          if (error.code === '23505') throw new Error('this checkout is being saved by another delivery')
          throw new Error(`order: ${error.message}`)
        }
        orderId = order.id as string
      }

      // Each line once. A line already saved by an earlier try has had its
      // stock taken, so it is skipped; the others are saved now.
      const { data: saved, error: savedError } = await admin.from('order_items').select('product_id, name, price, quantity').eq('order_id', orderId)
      if (savedError) throw new Error(`order lines read: ${savedError.message}`)
      const lineKey = (productId: string | null, name: string, price: number, quantity: number) => `${productId || ''}|${name}|${Number(price).toFixed(2)}|${quantity}`
      const already = new Map<string, number>()
      for (const row of (saved || []) as { product_id: string | null; name: string; price: number; quantity: number }[]) {
        const k = lineKey(row.product_id, row.name, row.price, row.quantity)
        already.set(k, (already.get(k) || 0) + 1)
      }
      for (const li of items.data) {
        const product = li.price?.product as Stripe.Product | undefined
        const productId = product?.metadata?.product_id || null
        const line = { order_id: orderId, product_id: productId, name: li.description || product?.name || 'Item', price: (li.price?.unit_amount || 0) / 100, quantity: li.quantity || 1 }
        const k = lineKey(line.product_id, line.name, line.price, line.quantity)
        if ((already.get(k) || 0) > 0) {
          already.set(k, (already.get(k) || 0) - 1)
          continue
        }
        const taken = productId ? await takeStock(admin, productId, line.quantity) : 0
        const { error: lineError } = await admin.from('order_items').insert(line)
        if (lineError) {
          if (productId) await returnStock(admin, productId, taken)
          throw new Error(`order line: ${lineError.message}`)
        }
      }

      const cartIds = String(s.metadata.cart_item_ids || '').split(',').filter(Boolean)
      if (cartIds.length) {
        const { error: cartError } = await admin.from('cart_items').delete().in('id', cartIds).eq('user_id', s.metadata.user_id)
        if (cartError) throw new Error(`cart: ${cartError.message}`)
      }
      const { error: noticeError } = await admin.from('vendor_notifications').upsert(
        { user_id: s.metadata.vendor_user_id, kind: 'order', ref: orderId, title: 'A new order', body: `${items.data.length} item${items.data.length === 1 ? '' : 's'}, ${((s.amount_total || 0) / 100).toFixed(2)} ${String(s.currency || 'cad').toUpperCase()}. Ship it, then mark it shipped.`, link: `${(process.env.NEXT_PUBLIC_GOAL_PLANNING_URL || 'https://app.autinerary.ca').replace(/\/$/, '')}/business#orders` },
        { onConflict: 'user_id,kind,ref', ignoreDuplicates: true }
      )
      if (noticeError) throw new Error(`vendor notice: ${noticeError.message}`)

      // Last: the order is complete, so a repeat of this notice is only a repeat.
      const now = new Date().toISOString()
      const { error: doneError } = await admin.from('orders').update({ paid_at: now, updated_at: now }).eq('id', orderId)
      if (doneError) throw new Error(`order done: ${doneError.message}`)
    }
  } catch (e: any) {
    console.error('[shop-webhook]', event.type, e?.message)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
