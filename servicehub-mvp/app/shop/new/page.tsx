'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { SHOP_GROUPS, SHOP_CATEGORIES, shopCategory } from '@/lib/shop/categories'
import { qualitiesForGroup } from '@/lib/shop/qualities'

/**
 * Suggest a product (the products round's planning note, Goal 1: "Have
 * entire team list all & any products that worked, especially that took
 * time to find, & rare finds!!!"; anyone signed in can). It waits as
 * pending: the team checks it on its maker's or seller's pages, then it goes
 * up (ResourceHub's admin Requests).
 */
export default function SuggestProductPage() {
  const [form, setForm] = useState({ name: '', brand: '', category: 'sensory-sound', buy_url: '', maker_url: '', price: '', currency: 'CAD', description: '' })
  const [qualities, setQualities] = useState<string[]>([])
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState('')
  const group = shopCategory(form.category).group
  const options = useMemo(() => qualitiesForGroup(group), [group])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('busy')
    setError('')
    const res = await fetch('/api/shop/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, price: form.price === '' ? null : Number(form.price), qualities: qualities.filter((q) => options.some((o) => o.id === q)) }),
    }).catch(() => null)
    const json = await res?.json().catch(() => null)
    if (res?.ok) setState('done')
    else {
      setState('idle')
      setError(json?.error || 'Could not send that just now.')
    }
  }

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/shop" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-800 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the shop
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Suggest a product</h1>
        <p className="mt-2 text-sm text-gray-800">
          Something that worked for you or someone you support, especially a rare find? Tell us. The team checks it on its maker&apos;s
          or seller&apos;s own pages before it goes up.
        </p>

        {state === 'done' ? (
          <div role="status" className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-gray-900">
            <p className="text-lg font-semibold">Thank you!</p>
            <p className="mt-1">We&apos;ll check it and add it to the shop. You can rate it once it is up.</p>
            <div className="mt-3 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setForm({ name: '', brand: '', category: form.category, buy_url: '', maker_url: '', price: '', currency: 'CAD', description: '' })
                  setQualities([])
                  setState('idle')
                }}
                className="font-medium text-blue-800 underline underline-offset-2"
              >
                Suggest another
              </button>
              <Link href="/shop" className="font-medium text-blue-800 underline underline-offset-2">
                Back to the shop
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-gray-900">
                Its name
                <input required minLength={2} maxLength={200} className={`mt-1 ${input}`} value={form.name} onChange={set('name')} placeholder="Loop Engage" />
              </label>
              <label className="block text-sm font-medium text-gray-900">
                Who makes it (optional)
                <input maxLength={120} className={`mt-1 ${input}`} value={form.brand} onChange={set('brand')} placeholder="Loop" />
              </label>
            </div>
            <label className="block text-sm font-medium text-gray-900">
              Category
              <select className={`mt-1 ${input}`} value={form.category} onChange={(e) => {
                setForm((f) => ({ ...f, category: e.target.value }))
                setQualities([])
              }}>
                {SHOP_GROUPS.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {SHOP_CATEGORIES.filter((c) => c.group === g.id).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-900">
              Where to get it (a link to the product)
              <input required type="url" maxLength={500} className={`mt-1 ${input}`} value={form.buy_url} onChange={set('buy_url')} placeholder="https://" />
            </label>
            <label className="block text-sm font-medium text-gray-900">
              The maker&apos;s page, if different (optional)
              <input type="url" maxLength={500} className={`mt-1 ${input}`} value={form.maker_url} onChange={set('maker_url')} placeholder="https://" />
            </label>
            <div className="grid grid-cols-[1fr_8rem] gap-4">
              <label className="block text-sm font-medium text-gray-900">
                Price (optional; leave empty if it varies)
                <input type="number" min="0" step="0.01" className={`mt-1 ${input}`} value={form.price} onChange={set('price')} placeholder="34.00" />
              </label>
              <label className="block text-sm font-medium text-gray-900">
                Currency
                <select className={`mt-1 ${input}`} value={form.currency} onChange={set('currency')}>
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </label>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900">What it&apos;s like (tick only what you know is true)</legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {options.map((q) => (
                  <label key={q.id} className="flex items-start gap-2 text-sm text-gray-900" title={q.help}>
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      checked={qualities.includes(q.id)}
                      onChange={(e) => setQualities((x) => (e.target.checked ? [...x, q.id] : x.filter((y) => y !== q.id)))}
                    />
                    {q.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-medium text-gray-900">
              Why it helps (optional)
              <textarea maxLength={1000} rows={3} className={`mt-1 ${input}`} value={form.description} onChange={set('description')} placeholder="No seams, so my son can wear them all day." />
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-800">
                {error}
              </p>
            )}
            <button type="submit" disabled={state === 'busy'} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
              <Check className="h-4 w-4" aria-hidden="true" /> {state === 'busy' ? 'Sending…' : 'Suggest it'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  )
}
