'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Trash2 } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { formatPrice } from '@/types/shop'

interface Line {
  id: string
  product_id: string
  variation: Record<string, string>
  quantity: number
  product: { id: string; name: string; brand: string | null; price: number | null; currency: string; seller: string | null; vendor_user_id: string | null } | null
}

/**
 * The cart (the products round, Goal 9): products bought through ResourceHub,
 * grouped by seller, since each seller is paid separately (Stripe Connect).
 * Checking out opens Stripe for one seller at a time.
 */
export default function CartPage() {
  const [lines, setLines] = useState<Line[] | null>(null)
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(
    () =>
      fetch('/api/shop/cart', { cache: 'no-store', credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          setLines(d.lines || [])
          setOn(Boolean(d.checkout))
        })
        .catch(() => setLines([])),
    []
  )
  useEffect(() => {
    void load()
  }, [load])

  const call = async (method: string, body: object) => {
    await fetch('/api/shop/cart', { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) }).catch(() => null)
    void load()
  }
  const checkout = async (vendor: string) => {
    setBusy(vendor)
    setError('')
    const res = await fetch('/api/shop/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ vendor }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (res?.ok && d?.url) window.location.href = d.url
    else {
      setBusy('')
      setError(d?.error || 'Checkout didn’t open. Please try again.')
    }
  }

  const groups = new Map<string, Line[]>()
  for (const l of lines || []) {
    const v = l.product?.vendor_user_id || 'none'
    groups.set(v, [...(groups.get(v) || []), l])
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ShoppingCart className="h-6 w-6 text-blue-700" aria-hidden="true" /> Your cart
        </h1>
        {!on && <p className="mt-3 rounded-lg border border-gray-300 bg-white p-4 text-gray-900">Buying through ResourceHub isn&apos;t on yet. Each product says where to get it.</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {lines === null ? (
          <p className="mt-4 text-gray-700">Loading…</p>
        ) : lines.length === 0 ? (
          <p className="mt-4 text-gray-800">
            Nothing in your cart.{' '}
            <Link href="/shop" className="font-medium text-blue-800 underline underline-offset-2">
              Back to the shop
            </Link>
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {Array.from(groups.entries()).map(([vendor, ls]) => {
              const currency = ls[0].product?.currency || 'CAD'
              const total = ls.reduce((s, l) => s + (l.product?.price || 0) * l.quantity, 0)
              return (
                <section key={vendor} aria-label={`From ${ls[0].product?.seller || 'this seller'}`} className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="text-lg font-semibold text-gray-900">From {ls[0].product?.seller || 'this seller'}</h2>
                  <ul className="mt-3 divide-y divide-gray-100">
                    {ls.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <span>
                          <Link href={`/shop/${l.product_id}`} className="font-medium text-gray-900 underline underline-offset-2">
                            {l.product?.name || 'A product'}
                          </Link>
                          {Object.keys(l.variation || {}).length > 0 && (
                            <span className="block text-xs text-gray-700">
                              {Object.entries(l.variation).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-3">
                          <label className="sr-only" htmlFor={`qty-${l.id}`}>
                            How many
                          </label>
                          <input id={`qty-${l.id}`} type="number" min={1} max={20} value={l.quantity} onChange={(e) => call('PATCH', { id: l.id, quantity: Number(e.target.value) })} className="w-16 rounded-lg border border-gray-300 px-2 py-1 text-gray-900" />
                          <span className="w-24 text-right text-sm font-semibold text-gray-900">{formatPrice((l.product?.price || 0) * l.quantity, l.product?.currency || 'CAD')}</span>
                          <button type="button" onClick={() => call('DELETE', { id: l.id })} aria-label={`Remove ${l.product?.name || 'this'}`} className="rounded p-1 text-gray-700 hover:bg-gray-100">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-gray-800">
                      {formatPrice(total, currency)} before any discount, shipping and tax. The seller ships it; you pay them through Stripe.
                    </p>
                    <button type="button" disabled={!on || vendor === 'none' || Boolean(busy)} onClick={() => checkout(vendor)} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                      {busy === vendor ? 'Opening…' : 'Check out'}
                    </button>
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
