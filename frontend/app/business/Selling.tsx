'use client'

import { useCallback, useEffect, useState } from 'react'
import { ORDER_STATUS, SHOP_CHECKOUT_ON } from '@/lib/shopSelling'

const primary = 'rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60'

/**
 * Selling through ResourceHub (the products round, Goals 9 and 10): set up
 * getting paid (Stripe), and process orders. Shown only once the team turns
 * the shop's checkout on.
 */
export default function Selling() {
  const [account, setAccount] = useState<{ charges_enabled: boolean; details_submitted: boolean } | null | undefined>(undefined)
  const [orders, setOrders] = useState<any[]>([])
  const [tracking, setTracking] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    const [p, o] = await Promise.all([
      fetch('/api/business/payments', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
      fetch('/api/business/orders', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
    ])
    setAccount(p?.account || null)
    setOrders(o?.orders || [])
  }, [])
  useEffect(() => {
    if (SHOP_CHECKOUT_ON) void load()
  }, [load])
  if (!SHOP_CHECKOUT_ON) return null

  const onboard = async () => {
    const res = await fetch('/api/business/payments', { method: 'POST' }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok && d?.url) window.location.href = d.url
    else setMsg(d?.error || 'Stripe didn’t open.')
  }
  const act = async (id: string, action: string) => {
    if (action === 'cancel' && !window.confirm('Cancel this order and refund the buyer in full?')) return
    const res = await fetch('/api/business/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, tracking_url: tracking[id] || '' }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setMsg(res?.ok ? 'Saved.' : d?.error || 'Could not change that.')
    void load()
  }

  return (
    <section id="orders" aria-labelledby="selling" className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 id="selling" className="text-lg font-semibold text-slate-900">
        Selling through ResourceHub
      </h2>
      <p className="mt-1 text-sm text-slate-800">
        People can buy your products in ResourceHub&apos;s shop. You are the seller: you are paid through your own Stripe account, you
        ship, and you handle returns. ResourceHub takes a small fee from each sale.
      </p>
      {msg && (
        <p role="status" className="mt-2 text-sm text-slate-900">
          {msg}
        </p>
      )}
      {account === undefined ? (
        <p className="mt-3 text-slate-700">Looking…</p>
      ) : account?.charges_enabled ? (
        <p className="mt-3 text-slate-900">Getting paid is set up. Turn on &ldquo;Sell it through ResourceHub&rdquo; on each product.</p>
      ) : (
        <button type="button" onClick={onboard} className={`mt-3 ${primary}`}>
          {account ? 'Finish setting up getting paid' : 'Set up getting paid (Stripe)'}
        </button>
      )}
      {orders.length > 0 && (
        <ul className="mt-4 space-y-3">
          {orders.map((o) => (
            <li key={o.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-900">
                {new Date(o.created_at).toLocaleDateString('en-CA')} · {Number(o.total).toFixed(2)} {o.currency} · {ORDER_STATUS[o.status] || o.status}
              </p>
              <ul className="text-sm text-slate-800">
                {o.items.map((i: any, n: number) => (
                  <li key={n}>
                    {i.quantity} × {i.name}
                  </li>
                ))}
              </ul>
              {o.shipping_address?.address && (
                <p className="mt-1 text-xs text-slate-700">
                  To {o.shipping_address.name}, {[o.shipping_address.address.line1, o.shipping_address.address.line2, o.shipping_address.address.city, o.shipping_address.address.state, o.shipping_address.address.postal_code].filter(Boolean).join(', ')}
                </p>
              )}
              {o.returns.length > 0 && <p className="mt-1 text-sm font-medium text-slate-900">Return started{o.returns[0].reason ? `: ${o.returns[0].reason}` : ''}</p>}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                {o.status === 'processing' && (
                  <>
                    <label className="block text-sm text-slate-900">
                      Tracking link (optional)
                      <input value={tracking[o.id] || ''} onChange={(e) => setTracking((t) => ({ ...t, [o.id]: e.target.value }))} className="mt-1 w-64 rounded-lg border border-slate-300 px-3 py-2" />
                    </label>
                    <button type="button" onClick={() => act(o.id, 'shipped')} className={primary}>
                      Mark shipped
                    </button>
                    <button type="button" onClick={() => act(o.id, 'cancel')} className="rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">
                      Cancel and refund
                    </button>
                  </>
                )}
                {o.status === 'shipped' && (
                  <button type="button" onClick={() => act(o.id, 'delivered')} className={primary}>
                    Mark delivered
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** On one product: sell it through ResourceHub, or stop. */
export function SellToggle({ productId }: { productId: string }) {
  const [msg, setMsg] = useState('')
  if (!SHOP_CHECKOUT_ON) return null
  const set = async (on: boolean) => {
    const res = await fetch('/api/business/sell', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, on }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setMsg(res?.ok ? (on ? 'People can now buy it in the shop.' : 'It is no longer sold here; the shop lists where to get it.') : d?.error || 'Could not change that.')
  }
  return (
    <section aria-label="Sell it through ResourceHub" className="rounded-lg bg-slate-50 p-3">
      <p className="text-sm font-medium text-slate-900">Sell it through ResourceHub</p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => set(true)} className={primary}>
          Sell it here
        </button>
        <button type="button" onClick={() => set(false)} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-white">
          Stop
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-slate-900">{msg}</p>}
    </section>
  )
}
