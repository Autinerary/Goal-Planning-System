'use client'

import { useEffect, useMemo, useState } from 'react'
import { SHOP_CATEGORIES, SHOP_GROUPS, SERVICE_CATEGORIES, qualitiesFor } from '@/lib/shop/taxonomy'

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900'
const primary = 'rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60'
const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']
const STATUS: Record<string, string> = { pending: 'With the team', active: 'In the shop', rejected: 'Not approved', draft: 'Draft', archived: 'Archived' }

async function post(path: string, body: object) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
  const data = await res?.json().catch(() => ({}))
  return { ok: Boolean(res?.ok), data: data || {} }
}

/** A product vendor adds a product they sell (the products round, Goal 10); the team checks it first. */
export function AddProduct() {
  const [form, setForm] = useState({ name: '', brand: '', category: 'sensory-sound', description: '', price: '', currency: 'CAD', buy_url: '', maker_url: '', stock: '' })
  const [qualities, setQualities] = useState<string[]>([])
  const [mine, setMine] = useState<{ id: string; name: string; status: string }[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const options = useMemo(() => qualitiesFor(form.category), [form.category])
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const load = () =>
    fetch('/api/business/products', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setMine(d.products || []))
      .catch(() => {})
  useEffect(() => {
    void load()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, data } = await post('/api/business/products', { ...form, qualities })
    setBusy(false)
    setMsg({ ok, text: ok ? 'Sent to the team. It goes in the shop once checked, and then you manage it here.' : data.error || 'Could not add that.' })
    if (ok) {
      setForm((f) => ({ ...f, name: '', description: '', price: '', buy_url: '', maker_url: '', stock: '' }))
      setQualities([])
      void load()
    }
  }

  return (
    <section aria-labelledby="add-product" className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 id="add-product" className="text-lg font-semibold text-slate-900">
        Add a product you sell
      </h2>
      <p className="mt-1 text-sm text-slate-800">People rate it once it is in the shop. Tick only qualities that are true; the team checks them on your product page.</p>
      {mine.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-800">
          {mine.map((p) => (
            <li key={p.id}>
              {p.name} · {STATUS[p.status] || p.status}
            </li>
          ))}
        </ul>
      )}
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-slate-900' : 'text-red-800'}`}>
          {msg.text}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-900">
          Product name
          <input required minLength={2} value={form.name} onChange={set('name')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Brand (optional)
          <input value={form.brand} onChange={set('brand')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
          Category
          <select value={form.category} onChange={(e) => { setForm((f) => ({ ...f, category: e.target.value })); setQualities([]) }} className={input}>
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
        <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
          What it is, in a sentence or two
          <textarea rows={3} maxLength={1500} value={form.description} onChange={set('description')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Your page for it (where people get it)
          <input required type="url" value={form.buy_url} onChange={set('buy_url')} className={input} placeholder="https://" />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Price (empty if it varies)
          <input type="number" min={0} step="0.01" value={form.price} onChange={set('price')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Currency
          <select value={form.currency} onChange={set('currency')} className={input}>
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-900">
          In stock (optional)
          <input type="number" min={0} value={form.stock} onChange={set('stock')} className={input} />
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-900">What it&apos;s like</legend>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {options.map((q) => (
              <label key={q.id} className="flex items-start gap-2 text-sm text-slate-900" title={q.help}>
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={qualities.includes(q.id)} onChange={(e) => setQualities((x) => (e.target.checked ? [...x, q.id] : x.filter((y) => y !== q.id)))} />
                {q.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={primary}>
            {busy ? 'Sending…' : 'Send to the team'}
          </button>
        </div>
      </form>
    </section>
  )
}

/** A service provider adds a service they offer (the products round, Goal 10: "do the same for service providers"). */
export function AddService() {
  const [form, setForm] = useState({ name: '', category: 'Therapist', description: '', address: '', city: '', province: 'ON', phone: '', email: '', website: '', cost: '', delivery: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { ok, data } = await post('/api/business/services', form)
    setBusy(false)
    setMsg({ ok, text: ok ? 'Sent to the team. Once it is checked it goes into ResourceHub, and you manage it here.' : data.error || 'Could not add that.' })
    if (ok) setForm((f) => ({ ...f, name: '', description: '', address: '', phone: '', email: '', website: '' }))
  }
  return (
    <section aria-labelledby="add-service" className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 id="add-service" className="text-lg font-semibold text-slate-900">
        Add a service you offer
      </h2>
      <p className="mt-1 text-sm text-slate-800">Another location, a group, a program: each is its own listing, so people can rate it.</p>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`mt-3 text-sm ${msg.ok ? 'text-slate-900' : 'text-red-800'}`}>
          {msg.text}
        </p>
      )}
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-900">
          Its name
          <input required minLength={2} value={form.name} onChange={set('name')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Kind of service
          <select value={form.category} onChange={set('category')} className={input}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
          What it offers, and who it is for
          <textarea required minLength={20} rows={3} maxLength={900} value={form.description} onChange={set('description')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
          Street address (empty if online only)
          <input value={form.address} onChange={set('address')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          City
          <input value={form.city} onChange={set('city')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Province or territory
          <select value={form.province} onChange={set('province')} className={input}>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Phone
          <input value={form.phone} onChange={set('phone')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Email for families
          <input type="email" value={form.email} onChange={set('email')} className={input} />
        </label>
        <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
          Website
          <input type="url" value={form.website} onChange={set('website')} className={input} placeholder="https://" />
        </label>
        <label className="block text-sm font-medium text-slate-900">
          Free or paid
          <select value={form.cost} onChange={set('cost')} className={input}>
            <option value="">Not saying</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-900">
          In person or online
          <select value={form.delivery} onChange={set('delivery')} className={input}>
            <option value="">Not saying</option>
            <option value="in_person">In person</option>
            <option value="online">Online</option>
            <option value="both">Both</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={primary}>
            {busy ? 'Sending…' : 'Send to the team'}
          </button>
        </div>
      </form>
    </section>
  )
}

/** A Resource Account's notices: coming discount events, orders, reviews. */
export function Notices() {
  const [items, setItems] = useState<{ id: string; title: string; body: string | null; link: string | null; read_at: string | null }[]>([])
  useEffect(() => {
    fetch('/api/business/notifications', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setItems(d.notifications || []))
      .catch(() => {})
  }, [])
  const unread = items.filter((n) => !n.read_at)
  if (!unread.length) return null
  return (
    <section aria-labelledby="notices" className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
      <h2 id="notices" className="text-lg font-semibold text-slate-900">
        For you
      </h2>
      <ul className="mt-2 space-y-2">
        {unread.map((n) => (
          <li key={n.id} className="text-sm text-slate-900">
            <strong>{n.title}</strong>
            {n.body ? ` ${n.body}` : ''}{' '}
            {n.link && (
              <a href={n.link} className="font-medium text-indigo-800 underline underline-offset-2">
                Open
              </a>
            )}{' '}
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/business/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) }).catch(() => null)
                setItems((x) => x.map((y) => (y.id === n.id ? { ...y, read_at: new Date().toISOString() } : y)))
              }}
              className="text-xs font-medium text-slate-700 underline underline-offset-2"
            >
              Done
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
