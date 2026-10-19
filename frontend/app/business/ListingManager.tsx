'use client'

import { useCallback, useEffect, useState } from 'react'
import ProductDiscounts from './ProductDiscounts'
import { SellToggle } from './Selling'

type Kind = 'resource' | 'product'
interface Field {
  field: string
  label: string
  when: 'now' | 'review'
}
interface Promotion {
  id: string
  headline: string
  body: string | null
  image_url: string | null
  keywords: string[]
  provinces: string[]
  status: string
  starts_on: string | null
  ends_on: string | null
}
interface Details {
  name: string
  category: string
  image_url: string | null
  values: Record<string, string | number | string[] | null>
  fields: Field[]
  qualityOptions?: { id: string; label: string }[]
  insights: Record<string, number | string | null> | null
  edits: { id: string; changes: Record<string, unknown>; before: Record<string, unknown> | null; status: string; created_at: string }[]
  promotions: Promotion[]
}

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT']
const COUNTS: [string, string][] = [
  ['saves', 'Saved by'],
  ['saves_30_days', 'Saved in the last 30 days'],
  ['on_teams', 'On someone’s team'],
  ['ratings', 'Ratings'],
  ['average', 'Average rating'],
  ['reviews', 'Reviews'],
  ['comments', 'Comments'],
  ['recommendations', 'Recommended by'],
  ['nominations_this_month', 'Community’s Choice nominations this month'],
]
const STANDING: Record<string, string> = { warned: 'Rated under 4: a heads-up', probation: 'Rated 3.5 or under: two months to improve', hidden: 'Hidden from search for now', ok: 'In good standing' }
const PROMO_STATUS: Record<string, string> = { draft: 'Draft', submitted: 'With the team', approved: 'Approved', active: 'Showing', paused: 'Paused', ended: 'Ended', rejected: 'Not approved' }
const OPTIONS: Record<string, [string, string][]> = {
  cost_type: [
    ['', 'Not stated'],
    ['free', 'Free'],
    ['paid', 'Paid'],
  ],
  delivery: [
    ['', 'Not stated'],
    ['in_person', 'In person'],
    ['online', 'Online'],
    ['both', 'Both'],
  ],
}

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900'
const primary = 'rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60'
const secondary = 'rounded-lg border border-indigo-700 px-4 py-2 font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-60'

/**
 * One listing its owner manages: its details (most change at once; the name,
 * picture and address wait for the team), the counts (never who), every
 * change so far, and promotions (Goal 11's "promote ads"), which don't show
 * until the team turns sponsored listings on.
 */
export default function ListingManager({ kind, id }: { kind: Kind; id: string }) {
  const [d, setD] = useState<Details | null>(null)
  const [error, setError] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState('')
  const [promo, setPromo] = useState({ headline: '', body: '', image_url: '', keywords: '', provinces: [] as string[], starts_on: '', ends_on: '' })
  const [qualities, setQualities] = useState<string[]>([])

  const load = useCallback(async () => {
    const res = await fetch(`/api/business/listing?kind=${kind}&id=${id}`, { cache: 'no-store' }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    if (!res?.ok) return setError(data?.error || 'Could not load this listing.')
    setD(data)
    setValues(Object.fromEntries(Object.entries(data.values || {}).filter(([k]) => k !== 'qualities').map(([k, v]) => [k, v == null ? '' : String(v)])))
    setQualities(Array.isArray(data.values?.qualities) ? data.values.qualities : [])
  }, [kind, id])
  useEffect(() => {
    void load()
  }, [load])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('save')
    const changes = kind === 'product' ? { ...values, qualities } : values
    const res = await fetch('/api/business/listing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, changes }) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    if (!res?.ok) return setSaved(data?.error || 'Could not save.')
    const label = (f: string) => d?.fields.find((x) => x.field === f)?.label.toLowerCase() || f
    setSaved(
      [
        data.applied?.length ? `Saved: ${data.applied.map(label).join(', ')}.` : '',
        data.waiting?.length ? `Sent to the team: ${data.waiting.map(label).join(', ')}.` : '',
        data.rejected?.length ? `Not saved (check them): ${data.rejected.map(label).join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join(' ') || 'Nothing changed.'
    )
    void load()
  }

  const sendPromo = async (submit: boolean) => {
    setBusy(submit ? 'submit' : 'draft')
    const res = await fetch('/api/business/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, ...promo, submit }) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    if (!res?.ok) return setSaved(data?.error || 'Could not save the promotion.')
    setPromo({ headline: '', body: '', image_url: '', keywords: '', provinces: [], starts_on: '', ends_on: '' })
    setSaved(submit ? 'Promotion sent to the team.' : 'Promotion saved as a draft.')
    void load()
  }

  const setPromoStatus = async (p: Promotion, status: string) => {
    await fetch('/api/business/promotions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status }) }).catch(() => null)
    void load()
  }

  if (error) return <p className="mt-3 text-red-800">{error}</p>
  if (!d) return <p className="mt-3 text-slate-700">Loading…</p>

  return (
    <div className="mt-4 space-y-6">
      {saved && (
        <p role="status" className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-slate-900">
          {saved}
        </p>
      )}

      <section aria-label="How people use it">
        <h3 className="font-semibold text-slate-900">How people use it</h3>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COUNTS.filter(([k]) => d.insights && d.insights[k] !== undefined).map(([k, label]) => (
            <div key={k} className="rounded-lg bg-slate-50 p-3">
              <dt className="text-xs text-slate-700">{label}</dt>
              <dd className="text-xl font-bold text-slate-900">{d.insights?.[k] ?? '–'}</dd>
            </div>
          ))}
        </dl>
        {d.insights?.standing && <p className="mt-2 text-sm text-slate-800">Rating standing: {STANDING[String(d.insights.standing)] || String(d.insights.standing)}</p>}
        <p className="mt-1 text-xs text-slate-700">Counts only. We never show who saved, rated or nominated a listing.</p>
      </section>

      <form onSubmit={save} aria-label="Details">
        <h3 className="font-semibold text-slate-900">Details</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {d.fields.filter((f) => f.field !== 'qualities').map((f) => (
            <label key={f.field} className={`block text-sm font-medium text-slate-900 ${f.field === 'description' ? 'sm:col-span-2' : ''}`}>
              {f.label}
              {f.when === 'review' && <span className="font-normal text-slate-700"> (checked by the team)</span>}
              {OPTIONS[f.field] ? (
                <select value={values[f.field] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))} className={input}>
                  {OPTIONS[f.field].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : f.field === 'description' ? (
                <textarea value={values[f.field] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))} rows={5} maxLength={2000} className={input} />
              ) : (
                <input value={values[f.field] || ''} onChange={(e) => setValues((v) => ({ ...v, [f.field]: e.target.value }))} className={input} />
              )}
            </label>
          ))}
        </div>
        {kind === 'product' && (d.qualityOptions || []).length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-slate-900">
              What it&apos;s like <span className="font-normal text-slate-700">(checked by the team: tick only what is true)</span>
            </legend>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {(d.qualityOptions || []).map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-sm text-slate-900">
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
        )}
        {kind === 'resource' && (
          <div className="mt-3 text-sm text-slate-800">
            <p className="font-medium text-slate-900">Is this the right picture?</p>
            {d.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.image_url} alt={`The picture shown for ${d.name}`} className="mt-1 h-32 w-auto rounded-lg border border-slate-200 object-cover" />
            ) : (
              <p>No picture yet.</p>
            )}
            <p className="mt-1">To change it, put the web address of a photo you have the right to use in “Picture”. The team checks it first.</p>
          </div>
        )}
        <button type="submit" disabled={busy === 'save'} className={`mt-3 ${primary}`}>
          {busy === 'save' ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      {kind === 'product' && <SellToggle productId={id} />}
      {kind === 'product' && <ProductDiscounts productId={id} />}

      <section aria-label="Promotions">
        <h3 className="font-semibold text-slate-900">Promotions</h3>
        <p className="mt-1 text-sm text-slate-800">
          Ask to be shown beside searches that match what you offer, labelled “Sponsored”. The team checks each one.{' '}
          <strong>Sponsored listings aren&apos;t shown yet</strong>: we will tell everyone, and update the privacy page, before
          they are.
        </p>
        {d.promotions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {d.promotions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                <span className="text-slate-900">
                  <strong>{p.headline}</strong> · {PROMO_STATUS[p.status] || p.status}
                  {p.starts_on || p.ends_on ? ` · ${p.starts_on || '…'} to ${p.ends_on || '…'}` : ''}
                </span>
                <span className="flex gap-2">
                  {p.status === 'draft' && (
                    <button type="button" onClick={() => setPromoStatus(p, 'submitted')} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
                      Send to the team
                    </button>
                  )}
                  {p.status === 'active' && (
                    <button type="button" onClick={() => setPromoStatus(p, 'paused')} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
                      Pause
                    </button>
                  )}
                  {['draft', 'submitted', 'paused', 'active'].includes(p.status) && (
                    <button type="button" onClick={() => setPromoStatus(p, 'ended')} className="text-sm font-medium text-red-800 underline underline-offset-2">
                      End
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
            Headline (up to 90 characters)
            <input value={promo.headline} maxLength={90} onChange={(e) => setPromo((p) => ({ ...p, headline: e.target.value }))} className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-900 sm:col-span-2">
            A sentence or two (optional, up to 200)
            <textarea value={promo.body} maxLength={200} rows={2} onChange={(e) => setPromo((p) => ({ ...p, body: e.target.value }))} className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Picture (https web address, optional)
            <input value={promo.image_url} onChange={(e) => setPromo((p) => ({ ...p, image_url: e.target.value }))} className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Searches to match (words, separated by commas)
            <input value={promo.keywords} onChange={(e) => setPromo((p) => ({ ...p, keywords: e.target.value }))} className={input} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-900">Provinces (none means anywhere)</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {PROVINCES.map((pr) => (
                <label key={pr} className="flex items-center gap-1 text-sm text-slate-900">
                  <input
                    type="checkbox"
                    checked={promo.provinces.includes(pr)}
                    onChange={(e) => setPromo((p) => ({ ...p, provinces: e.target.checked ? [...p.provinces, pr] : p.provinces.filter((x) => x !== pr) }))}
                    className="h-4 w-4"
                  />
                  {pr}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium text-slate-900">
            From (optional)
            <input type="date" value={promo.starts_on} onChange={(e) => setPromo((p) => ({ ...p, starts_on: e.target.value }))} className={input} />
          </label>
          <label className="block text-sm font-medium text-slate-900">
            Until (optional)
            <input type="date" value={promo.ends_on} onChange={(e) => setPromo((p) => ({ ...p, ends_on: e.target.value }))} className={input} />
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="button" onClick={() => sendPromo(false)} disabled={!promo.headline.trim() || Boolean(busy)} className={secondary}>
              {busy === 'draft' ? 'Saving…' : 'Save as a draft'}
            </button>
            <button type="button" onClick={() => sendPromo(true)} disabled={!promo.headline.trim() || Boolean(busy)} className={primary}>
              {busy === 'submit' ? 'Sending…' : 'Send to the team'}
            </button>
          </div>
        </div>
      </section>

      {d.edits.length > 0 && (
        <section aria-label="Your changes">
          <h3 className="font-semibold text-slate-900">Your changes</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-800">
            {d.edits.map((e) => (
              <li key={e.id}>
                {new Date(e.created_at).toLocaleDateString('en-CA')}: {Object.keys(e.changes).map((f) => d.fields.find((x) => x.field === f)?.label || f).join(', ')} ·{' '}
                {e.status === 'applied' ? 'saved' : e.status === 'pending' ? 'with the team' : e.status === 'rejected' ? 'not approved' : 'undone by the team'}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
