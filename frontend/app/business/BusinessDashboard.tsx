'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ListingManager from './ListingManager'
import { AddProduct, AddService, Notices } from './AddOffering'
import Selling from './Selling'

const HUB = (process.env.NEXT_PUBLIC_SERVICE_HUB_URL || 'http://localhost:3001').replace(/\/$/, '')

type Kind = 'resource' | 'product'
interface Account {
  kind: 'service_provider' | 'product_vendor'
  organization: string
  role_title: string | null
  website: string | null
  contact_email: string | null
  phone: string | null
}
interface Found {
  kind: Kind
  id: string
  name: string
  where: string
  category: string
  email: string | null
  claimed: boolean
}
interface Claim {
  id: string
  item_kind: Kind
  item_id: string
  method: 'email_code' | 'review'
  code_sent_to: string | null
  code_expires_at: string | null
  status: 'pending' | 'verified' | 'rejected' | 'released'
  name: string
}

const input = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900'
const primary = 'rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60'
const secondary = 'rounded-lg border border-indigo-700 px-4 py-2 font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-60'

async function call(path: string, method: string, body?: object) {
  const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).catch(() => null)
  const data = await res?.json().catch(() => ({}))
  return { ok: Boolean(res?.ok), data: data || {} }
}

/**
 * The Resource Account: who you are (a service provider or a product
 * vendor), claiming your listing (a code sent to the listing's own email,
 * or the team checks), and managing each listing you run (ListingManager).
 */
export default function BusinessDashboard() {
  const params = useSearchParams()
  const [open, setOpen] = useState(true)
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ kind: 'service_provider', organization: '', role_title: '', website: '', contact_email: '', phone: '' })
  const [claims, setClaims] = useState<Claim[]>([])
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[] | null>(null)
  const [picked, setPicked] = useState<Found | null>(null)
  const [evidence, setEvidence] = useState('')
  const [codes, setCodes] = useState<Record<string, string>>({})
  const [managing, setManaging] = useState<string>('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState('')

  const loadAccount = useCallback(async () => {
    const { data } = await call('/api/business/account', 'GET')
    setOpen(data.open !== false)
    setAccount(data.account || null)
    if (data.account) setForm({ kind: data.account.kind, organization: data.account.organization || '', role_title: data.account.role_title || '', website: data.account.website || '', contact_email: data.account.contact_email || '', phone: data.account.phone || '' })
  }, [])
  const loadClaims = useCallback(async () => {
    const { data } = await call('/api/business/claims', 'GET')
    setClaims(data.claims || [])
  }, [])

  useEffect(() => {
    void loadAccount()
    void loadClaims()
  }, [loadAccount, loadClaims])

  // Back from paying for a sponsored listing's budget (promotions/checkout).
  useEffect(() => {
    if (params.get('promotion') === 'paid') setMsg({ ok: true, text: 'Thank you: your payment went through. The budget shows on the promotion once Stripe confirms it, usually within a minute.' })
  }, [params])

  // From "Claim this listing" in ResourceHub: ?claim=resource:<id>
  useEffect(() => {
    const m = /^(resource|product):([0-9a-f-]{36})$/i.exec(params.get('claim') || '')
    if (!m) return
    void call(`/api/business/search?kind=${m[1]}&id=${m[2]}`, 'GET').then(({ data }) => {
      const item = (data.items || [])[0]
      if (item) {
        setFound([item])
        setPicked(item)
      }
    })
  }, [params])

  const kind: Kind = (account?.kind || form.kind) === 'product_vendor' ? 'product' : 'resource'

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('account')
    const { ok, data } = await call('/api/business/account', 'POST', form)
    setBusy('')
    setMsg({ ok, text: ok ? 'Saved.' : data.error || 'Could not save that.' })
    if (ok) {
      setEditing(false)
      void loadAccount()
    }
  }

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    setPicked(null)
    const { data } = await call(`/api/business/search?kind=${kind}&q=${encodeURIComponent(q)}`, 'GET')
    setFound(data.items || [])
  }

  const claim = async (item: Found, method: 'email_code' | 'review') => {
    setBusy(`claim-${method}`)
    const { ok, data } = await call('/api/business/claims', 'POST', { kind: item.kind, id: item.id, method, evidence })
    setBusy('')
    setMsg({
      ok,
      text: ok ? (method === 'email_code' ? `We sent a code to ${data.sentTo}. Enter it below; it works for ${data.minutes} minutes.` : 'Sent to the team. We will email you when it is checked.') : data.error || 'That didn’t work.',
    })
    if (ok) {
      setPicked(null)
      setFound(null)
      setEvidence('')
      void loadClaims()
    }
  }

  const verify = async (c: Claim) => {
    setBusy(`verify-${c.id}`)
    const { ok, data } = await call('/api/business/claims/verify', 'POST', { id: c.id, code: codes[c.id] || '' })
    setBusy('')
    setMsg({ ok, text: ok ? `You now manage ${c.name}.` : data.error || 'That code didn’t work.' })
    if (ok) {
      await loadClaims()
      setManaging(c.id)
    }
  }

  if (account === undefined) return <p className="text-slate-700">Loading…</p>

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-indigo-800">ResourceHub</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Your Resource Account</h1>
        <p className="mt-3 leading-relaxed text-slate-800">
          For services and product sellers listed in ResourceHub. Claim your listing to keep it right, see how people use it
          (counts only, never who), and ask for a promotion. Ratings and comments stay the community&apos;s: you can&apos;t change
          them.
        </p>
        {!open && <p className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-slate-900">Resource Accounts open soon.</p>}
      </header>

      {account && <Notices />}

      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg border p-3 ${msg.ok ? 'border-emerald-300 bg-emerald-50 text-slate-900' : 'border-red-300 bg-red-50 text-red-900'}`}>
          {msg.text}
        </p>
      )}

      <section aria-labelledby="who" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id="who" className="text-lg font-semibold text-slate-900">
          1. Who you are
        </h2>
        {account && !editing ? (
          <div className="mt-2 text-slate-800">
            <p>
              <strong>{account.organization}</strong>, {account.kind === 'product_vendor' ? 'a product vendor' : 'a service provider'}
              {account.role_title ? ` (${account.role_title})` : ''}.
            </p>
            <button type="button" onClick={() => setEditing(true)} className="mt-2 text-sm font-medium text-indigo-800 underline underline-offset-2">
              Change
            </button>
          </div>
        ) : (
          <form onSubmit={saveAccount} className="mt-3 grid gap-3 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-slate-900">You are</legend>
              <div className="mt-1 flex flex-wrap gap-4">
                {[
                  ['service_provider', 'A service provider'],
                  ['product_vendor', 'A product vendor'],
                ].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 text-slate-900">
                    <input type="radio" name="kind" value={v} checked={form.kind === v} onChange={() => setForm((f) => ({ ...f, kind: v }))} className="h-4 w-4" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
            {(
              [
                ['organization', 'Organization or business name', true],
                ['role_title', 'Your role (optional)', false],
                ['website', 'Website (optional)', false],
                ['contact_email', 'Contact email for the team (optional)', false],
                ['phone', 'Phone (optional)', false],
              ] as [keyof typeof form, string, boolean][]
            ).map(([k, label, required]) => (
              <label key={k} className="block text-sm font-medium text-slate-900">
                {label}
                <input value={form[k]} required={required} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={input} />
              </label>
            ))}
            <div className="sm:col-span-2">
              <button type="submit" disabled={busy === 'account' || !form.organization.trim()} className={primary}>
                {busy === 'account' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </section>

      {account && (
        <section aria-labelledby="claim" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="claim" className="text-lg font-semibold text-slate-900">
            2. Claim your listing
          </h2>
          <form onSubmit={search} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block flex-1 text-sm font-medium text-slate-900">
              {kind === 'product' ? 'Your product’s name' : 'Your service’s name'}
              <input value={q} onChange={(e) => setQ(e.target.value)} className={input} />
            </label>
            <button type="submit" disabled={q.trim().length < 2} className={secondary}>
              Find it
            </button>
          </form>
          {found && found.length === 0 && (
            <p className="mt-3 text-slate-800">
              Nothing by that name.{' '}
              <a href={`${HUB}/resources/new`} className="font-medium text-indigo-800 underline underline-offset-2">
                Add it to ResourceHub
              </a>{' '}
              (a Spot Guide checks it), then claim it here.
            </p>
          )}
          {found && found.length > 0 && !picked && (
            <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
              {found.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="text-slate-900">
                    <strong>{f.name}</strong>
                    {f.where ? ` · ${f.where}` : ''}
                  </span>
                  {f.claimed ? (
                    <span className="text-sm text-slate-700">Already managed</span>
                  ) : (
                    <button type="button" onClick={() => setPicked(f)} className={secondary}>
                      This is mine
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {picked && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="font-semibold text-slate-900">{picked.name}</p>
              {picked.claimed ? (
                <p className="mt-1 text-slate-800">Someone already manages this listing. If that&apos;s wrong, email heydevs@autinerary.ca.</p>
              ) : (
                <>
                  {picked.email ? (
                    <div className="mt-2">
                      <p className="text-slate-800">We can send a code to the email this listing shows: {picked.email}.</p>
                      <button type="button" onClick={() => claim(picked, 'email_code')} disabled={Boolean(busy)} className={`mt-2 ${primary}`}>
                        {busy === 'claim-email_code' ? 'Sending…' : 'Send me a code'}
                      </button>
                    </div>
                  ) : (
                    <p className="mt-2 text-slate-800">This listing shows no email, so the team will check.</p>
                  )}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-900" htmlFor="evidence">
                      {picked.email ? 'Or ask the team to check: ' : ''}how can we check you run it? (your role, and a phone number or web page that shows it)
                    </label>
                    <textarea id="evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={3} maxLength={1000} className={input} />
                    <button type="button" onClick={() => claim(picked, 'review')} disabled={evidence.trim().length < 10 || Boolean(busy)} className={`mt-2 ${secondary}`}>
                      {busy === 'claim-review' ? 'Sending…' : 'Ask the team to check'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {account?.kind === 'product_vendor' && <Selling />}
      {account?.kind === 'product_vendor' && <AddProduct />}
      {account?.kind === 'service_provider' && <AddService />}

      {claims.length > 0 && (
        <section aria-labelledby="yours" className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 id="yours" className="text-lg font-semibold text-slate-900">
            3. Your listings
          </h2>
          <ul className="mt-3 space-y-3">
            {claims.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={`${HUB}/${c.item_kind === 'product' ? 'shop' : 'resources'}/${c.item_id}`} className="font-semibold text-indigo-800 underline underline-offset-2">
                    {c.name}
                  </a>
                  <span className="text-sm text-slate-700">
                    {c.status === 'verified' ? 'You manage this' : c.status === 'pending' ? (c.method === 'review' ? 'The team is checking' : 'Waiting for your code') : c.status === 'rejected' ? 'Not confirmed' : 'Released'}
                  </span>
                </div>
                {c.status === 'pending' && c.method === 'email_code' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="block text-sm font-medium text-slate-900">
                      The code sent to {c.code_sent_to}
                      <input
                        value={codes[c.id] || ''}
                        onChange={(e) => setCodes((x) => ({ ...x, [c.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 font-mono tracking-widest text-slate-900"
                      />
                    </label>
                    <button type="button" onClick={() => verify(c)} disabled={(codes[c.id] || '').length !== 6 || Boolean(busy)} className={primary}>
                      {busy === `verify-${c.id}` ? 'Checking…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => claim({ kind: c.item_kind, id: c.item_id, name: c.name, where: '', category: '', email: c.code_sent_to, claimed: false }, 'email_code')}
                      disabled={Boolean(busy)}
                      className="text-sm font-medium text-indigo-800 underline underline-offset-2"
                    >
                      Send a new code
                    </button>
                  </div>
                )}
                {c.status === 'verified' && (
                  <div className="mt-2">
                    <button type="button" onClick={() => setManaging(managing === c.id ? '' : c.id)} aria-expanded={managing === c.id} className={secondary}>
                      {managing === c.id ? 'Close' : 'Manage'}
                    </button>
                    {managing === c.id && <ListingManager kind={c.item_kind} id={c.item_id} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
