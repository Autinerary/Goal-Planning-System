'use client'

import { useCallback, useEffect, useState } from 'react'

interface DiscountEvent {
  id: string
  name: string
  description: string | null
  starts_on: string
  ends_on: string
  suggested_percent: number | null
}
interface Discount {
  id: string
  event_id: string | null
  percent: number | null
  sale_price: number | null
  code: string | null
  starts_on: string | null
  ends_on: string | null
  opted_in: boolean
}

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { day: 'numeric', month: 'long', year: 'numeric' })
const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900'

/**
 * Discounts on one product (the products round's planning note, Goal 10):
 * opt in or out of each coming discount event (Autism Acceptance Month, ADHD
 * Awareness Month, back to school...) with a percent, a sale price or a code
 * for your own store, or set your own dates (a launch). Shown in the shop only
 * during their dates, once the team turns discounts on.
 */
export default function ProductDiscounts({ productId }: { productId: string }) {
  const [events, setEvents] = useState<DiscountEvent[]>([])
  const [mine, setMine] = useState<Discount[]>([])
  const [open, setOpen] = useState(true)
  const [msg, setMsg] = useState('')
  const [own, setOwn] = useState({ percent: '', code: '', starts_on: '', ends_on: '' })
  const [drafts, setDrafts] = useState<Record<string, { percent: string; code: string }>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/business/discounts?product_id=${productId}`, { cache: 'no-store' }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setOpen(d?.open !== false)
    setEvents(d?.events || [])
    setMine(d?.discounts || [])
  }, [productId])
  useEffect(() => {
    void load()
  }, [load])

  const save = async (body: object) => {
    const res = await fetch('/api/business/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ product_id: productId, ...body }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setMsg(res?.ok ? 'Saved.' : d?.error || 'Could not save that.')
    void load()
  }

  if (!open) return null
  return (
    <section aria-label="Discounts">
      <h3 className="font-semibold text-slate-900">Discounts</h3>
      <p className="mt-1 text-sm text-slate-800">
        Offer a discount at times of year that matter to the community. Shown in the shop only during its dates, once the team turns
        discounts on. We tell you ahead of each one.
      </p>
      {msg && (
        <p role="status" className="mt-2 text-sm text-slate-900">
          {msg}
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {events.map((ev) => {
          const d = mine.find((m) => m.event_id === ev.id)
          const draft = drafts[ev.id] || { percent: d?.percent ? String(d.percent) : ev.suggested_percent ? String(ev.suggested_percent) : '', code: d?.code || '' }
          return (
            <li key={ev.id} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-slate-900">
                {ev.name} <span className="font-normal text-slate-700">· {day(ev.starts_on)} to {day(ev.ends_on)}</span>
              </p>
              {ev.description && <p className="text-sm text-slate-800">{ev.description}</p>}
              <p className="mt-1 text-sm text-slate-800">{d ? (d.opted_in ? `You're in: ${d.percent ? `${d.percent}% off` : `sale price ${d.sale_price}`}${d.code ? `, code ${d.code}` : ''}.` : 'You opted out.') : 'Not decided yet.'}</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="block text-sm text-slate-900">
                  Percent off
                  <input type="number" min={1} max={90} value={draft.percent} onChange={(e) => setDrafts((x) => ({ ...x, [ev.id]: { ...draft, percent: e.target.value } }))} className={`${input} w-24`} />
                </label>
                <label className="block text-sm text-slate-900">
                  Code for your store (optional)
                  <input value={draft.code} onChange={(e) => setDrafts((x) => ({ ...x, [ev.id]: { ...draft, code: e.target.value } }))} className={`${input} w-40`} />
                </label>
                <button type="button" onClick={() => save({ event_id: ev.id, opted_in: true, percent: draft.percent, code: draft.code })} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
                  Opt in
                </button>
                <button type="button" onClick={() => save({ event_id: ev.id, opted_in: false })} className="rounded-lg border border-slate-400 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  Opt out
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-3 rounded-lg bg-slate-50 p-3">
        <p className="text-sm font-medium text-slate-900">Your own dates (a launch, a sale)</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block text-sm text-slate-900">
            Percent off
            <input type="number" min={1} max={90} value={own.percent} onChange={(e) => setOwn((o) => ({ ...o, percent: e.target.value }))} className={`${input} w-24`} />
          </label>
          <label className="block text-sm text-slate-900">
            Code (optional)
            <input value={own.code} onChange={(e) => setOwn((o) => ({ ...o, code: e.target.value }))} className={`${input} w-36`} />
          </label>
          <label className="block text-sm text-slate-900">
            From
            <input type="date" value={own.starts_on} onChange={(e) => setOwn((o) => ({ ...o, starts_on: e.target.value }))} className={input} />
          </label>
          <label className="block text-sm text-slate-900">
            Until
            <input type="date" value={own.ends_on} onChange={(e) => setOwn((o) => ({ ...o, ends_on: e.target.value }))} className={input} />
          </label>
          <button type="button" onClick={() => save({ opted_in: true, ...own })} disabled={!own.percent || !own.starts_on || !own.ends_on} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-60">
            Add
          </button>
        </div>
        {mine.filter((m) => !m.event_id).length > 0 && (
          <ul className="mt-2 text-sm text-slate-800">
            {mine
              .filter((m) => !m.event_id)
              .map((m) => (
                <li key={m.id}>
                  {m.percent}% off, {m.starts_on && day(m.starts_on)} to {m.ends_on && day(m.ends_on)}
                  {m.code ? `, code ${m.code}` : ''}
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  )
}
