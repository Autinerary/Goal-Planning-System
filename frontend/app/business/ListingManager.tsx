'use client'

import { useCallback, useEffect, useState } from 'react'
import ProductDiscounts from './ProductDiscounts'
import { SellToggle } from './Selling'
import { formatMoney, PROMOTION_BUDGETS } from '@/lib/billing'

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
  // Since STEP 83.
  placements?: string[]
  bid_cents?: number | null
  budget_cents?: number | null
  spent_cents?: number
  impressions?: number
  clicks?: number
  paid_at?: string | null
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
  // Stripe is set up and sponsored listings are on (lib/stripe.ts).
  canPay?: boolean
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
// Where a promotion may show (STEP 83), in the owner's words.
const PLACES: [string, string][] = [
  ['search', 'Beside searches that match'],
  ['tidbits', 'Under Tidbits on its topic'],
  ['paths', 'Among the services a step of someone’s plan suggests (third, after two of the plan’s own)'],
]
const PLACE_SHORT: Record<string, string> = { search: 'Searches', tidbits: 'Tidbits', paths: 'Plans' }
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
  // The same words as ResourceHub's (servicehub-mvp/lib/waits.ts).
  wait_stated: [
    ['', 'Not stated'],
    ['no_wait', 'No wait'],
    ['under_1_month', 'Under a month'],
    ['1_3_months', '1 to 3 months'],
    ['3_6_months', '3 to 6 months'],
    ['6_12_months', '6 to 12 months'],
    ['over_1_year', 'Over a year'],
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
  const blank = { headline: '', body: '', image_url: '', keywords: '', provinces: [] as string[], starts_on: '', ends_on: '', placements: ['search'], bid: '' }
  const [promo, setPromo] = useState(blank)
  const [paying, setPaying] = useState<{ id: string; amount: number; agreed: boolean } | null>(null)
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
    const { bid, ...words } = promo
    const bidCents = bid.trim() ? Math.round(parseFloat(bid) * 100) : null
    const res = await fetch('/api/business/promotions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, id, ...words, bid_cents: bidCents, submit }) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    if (!res?.ok) return setSaved(data?.error || 'Could not save the promotion.')
    setPromo(blank)
    setSaved(submit ? 'Promotion sent to the team.' : 'Promotion saved as a draft.')
    void load()
  }

  const setPromoStatus = async (p: Promotion, status: string) => {
    await fetch('/api/business/promotions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, status }) }).catch(() => null)
    void load()
  }

  // Stripe's page to pay for a budget (app/api/business/promotions/checkout).
  const pay = async () => {
    if (!paying) return
    setBusy('pay')
    const res = await fetch('/api/business/promotions/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: paying.id, amount_cents: paying.amount, agreed: paying.agreed }) }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy('')
    if (!res?.ok || !data?.url) return setSaved(data?.error || 'Could not open the payment page.')
    window.location.href = data.url
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
          Ask to be shown where people are looking for what you offer, labelled “Sponsored”: beside matching searches, under
          Tidbits on its topic, or among the services a step of someone&apos;s plan suggests. The team checks each one. You pay
          only when someone clicks, what you chose a click is worth, from a budget you add; when it is spent, it stops. You see
          how often it was seen and clicked, never who. People on a paid plan don&apos;t see sponsored listings.{' '}
          {d.canPay ? null : (
            <>
              <strong>Sponsored listings aren&apos;t shown yet</strong>: we will tell everyone, and update the privacy page, before
              they are.
            </>
          )}
        </p>
        {d.promotions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {d.promotions.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                <span className="text-slate-900">
                  <strong>{p.headline}</strong> · {p.status === 'ended' && p.budget_cents != null && (p.spent_cents ?? 0) >= p.budget_cents ? 'Budget spent' : PROMO_STATUS[p.status] || p.status}
                  {p.starts_on || p.ends_on ? ` · ${p.starts_on || '…'} to ${p.ends_on || '…'}` : ''}
                  {p.placements && (
                    <span className="block text-sm text-slate-800">
                      {p.placements.map((x) => PLACE_SHORT[x] || x).join(', ')}
                      {p.bid_cents ? ` · ${formatMoney(p.bid_cents)} a click` : ' · no click price yet'}
                    </span>
                  )}
                  {p.impressions !== undefined && (
                    <span className="block text-sm text-slate-800">
                      Seen {p.impressions} {p.impressions === 1 ? 'time' : 'times'} · {p.clicks ?? 0} {p.clicks === 1 ? 'click' : 'clicks'}
                      {p.budget_cents != null ? ` · ${formatMoney(p.spent_cents ?? 0)} of ${formatMoney(p.budget_cents)} spent` : ''}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-2">
                  {p.status === 'draft' && (
                    <button type="button" onClick={() => setPromoStatus(p, 'submitted')} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
                      Send to the team
                    </button>
                  )}
                  {p.status === 'paused' && (
                    <button type="button" onClick={() => setPromoStatus(p, 'submitted')} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
                      Ask to show it again
                    </button>
                  )}
                  {d.canPay && p.bid_cents && p.status !== 'rejected' && (
                    <button type="button" onClick={() => setPaying({ id: p.id, amount: PROMOTION_BUDGETS[0], agreed: false })} className="text-sm font-medium text-indigo-800 underline underline-offset-2">
                      Add to its budget
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
        {paying && (
          <div role="group" aria-label="Add to its budget" className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-900">
            <p className="font-semibold">Add to its budget</p>
            <label className="mt-2 block font-medium">
              How much
              <select value={paying.amount} onChange={(e) => setPaying((x) => x && { ...x, amount: Number(e.target.value) })} className={input}>
                {PROMOTION_BUDGETS.map((a) => (
                  <option key={a} value={a}>
                    {formatMoney(a)}
                  </option>
                ))}
              </select>
            </label>
            <ul className="mt-3 list-disc space-y-1 pl-5">
              <li>You pay this once, by card, through Stripe. Taxes are added if they apply.</li>
              <li>Each click spends what you chose a click is worth, once a day per person. Views are free.</li>
              <li>It shows only while the team has approved it. When the budget is spent, it stops.</li>
              <li>What is left is yours: pause or end it, and ask us for it back at any time.</li>
            </ul>
            <label className="mt-3 flex items-start gap-2">
              <input type="checkbox" checked={paying.agreed} onChange={(e) => setPaying((x) => x && { ...x, agreed: e.target.checked })} className="mt-0.5 h-4 w-4" />I have read how it works, and agree.
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={pay} disabled={!paying.agreed || busy === 'pay'} className={primary}>
                {busy === 'pay' ? 'Opening Stripe…' : `Pay ${formatMoney(paying.amount)}`}
              </button>
              <button type="button" onClick={() => setPaying(null)} className={secondary}>
                Not now
              </button>
            </div>
          </div>
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
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-900">Where it may show</legend>
            <div className="mt-1 space-y-1">
              {PLACES.map(([place, label]) => (
                <label key={place} className="flex items-start gap-2 text-sm text-slate-900">
                  <input
                    type="checkbox"
                    checked={promo.placements.includes(place)}
                    onChange={(e) => setPromo((p) => ({ ...p, placements: e.target.checked ? [...p.placements, place] : p.placements.filter((x) => x !== place) }))}
                    className="mt-0.5 h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm font-medium text-slate-900">
            What a click is worth to you ($0.05 to $20)
            <input type="number" inputMode="decimal" min="0.05" max="20" step="0.05" value={promo.bid} onChange={(e) => setPromo((p) => ({ ...p, bid: e.target.value }))} className={input} />
          </label>
          <p className="self-end text-xs text-slate-700">When several match, each is shown in proportion to what a click is worth to it. You pay only for clicks.</p>
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
