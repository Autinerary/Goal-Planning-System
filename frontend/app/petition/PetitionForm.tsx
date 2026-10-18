'use client'

import { useEffect, useState } from 'react'
import { PETITION_ASKS, PETITION_HASHTAG, PROVINCES, shareLinks } from '@/lib/petition'

interface Counts {
  open?: boolean
  total: number
  by_ask: Record<string, number>
  top: { institution: string; ask: string; n: number }[]
  recent: { name: string; province: string | null }[]
}

/** Signing #FundAutinerary, the counts so far, and sharing it. */
export default function PetitionForm() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [form, setForm] = useState({ name: '', email: '', province: 'ON', ask: 'government', institution: '', comment: '', showName: false, contactOk: false, website: '' })
  const [busy, setBusy] = useState(false)
  const [signed, setSigned] = useState(false)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('https://app.autinerary.ca/petition')
  const [copied, setCopied] = useState(false)

  const load = () =>
    fetch('/api/petition', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCounts(d))
      .catch(() => {})
  useEffect(() => {
    void load()
    setUrl(`${window.location.origin}/petition`)
    // From "Ask your workplace" or "your city" (Free access).
    const ask = new URLSearchParams(window.location.search).get('ask')
    if (ask && PETITION_ASKS.some((a) => a.id === ask)) setForm((f) => ({ ...f, ask }))
  }, [])

  const sign = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await fetch('/api/petition', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    setBusy(false)
    if (res?.ok) {
      setSigned(true)
      void load()
    } else setError(d?.error || 'Could not sign just now.')
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  const institutionLabel = form.ask === 'government' ? 'Which government (optional)' : form.ask === 'city' ? 'Which city or town' : form.ask === 'workplace' ? 'Which workplace' : 'Which school'

  return (
    <div className="space-y-8">
      {counts && counts.open !== false && (
        <p className="text-lg text-slate-900">
          <span className="text-3xl font-bold">{counts.total.toLocaleString('en-CA')}</span> {counts.total === 1 ? 'person has' : 'people have'} signed.
        </p>
      )}

      {signed ? (
        <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="text-lg font-semibold text-slate-900">Thank you for signing!</p>
          <p className="mt-1 text-slate-800">Now share it, with {PETITION_HASHTAG}: every voice helps your school, workplace or government say yes.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {shareLinks(url).map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">
                  {s.label}
                </a>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${url} ${PETITION_HASHTAG}`)
                    setCopied(true)
                  } catch {}
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {copied ? 'Copied' : 'Copy the link'}
              </button>
            </li>
          </ul>
        </div>
      ) : counts?.open === false ? (
        <p className="rounded-lg bg-amber-50 p-4 text-slate-900">The petition opens soon.</p>
      ) : (
        <form onSubmit={sign} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-900">Your name</span>
              <input value={form.name} onChange={set('name')} required maxLength={100} autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-900">Your email</span>
              <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-900">Who are you asking to fund Autinerary?</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {PETITION_ASKS.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-slate-900">
                  <input type="radio" name="ask" value={a.id} checked={form.ask === a.id} onChange={set('ask')} className="h-4 w-4" /> {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-900">{institutionLabel}</span>
              <input value={form.institution} onChange={set('institution')} maxLength={200} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-900">Province or territory</span>
              <select value={form.province} onChange={set('province')} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-900">
              Why it matters to you <span className="font-normal text-slate-700">(optional)</span>
            </span>
            <textarea value={form.comment} onChange={set('comment')} maxLength={500} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} className="hidden" />
          <label className="flex items-start gap-2 text-sm text-slate-900">
            <input type="checkbox" checked={form.showName} onChange={set('showName')} className="mt-0.5 h-4 w-4" /> Show my first name and province on this page
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-900">
            <input type="checkbox" checked={form.contactOk} onChange={set('contactOk')} className="mt-0.5 h-4 w-4" /> Email me about the campaign (you can stop at any time)
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-5 py-2.5 font-semibold text-white hover:bg-amber-800 disabled:opacity-60">
            {busy ? 'Signing…' : 'Sign the petition'}
          </button>
          <p className="text-xs text-slate-700">
            We use your name and email only for the petition: we count it, show your first name if you choose, and give the
            totals (never your email) to the people you are asking. See the privacy page.
          </p>
        </form>
      )}

      {counts && counts.top.length > 0 && (
        <section aria-labelledby="where">
          <h2 id="where" className="text-lg font-bold text-slate-900">
            Where people are asking
          </h2>
          <ul className="mt-2 space-y-1 text-slate-800">
            {counts.top.map((t) => (
              <li key={`${t.ask}-${t.institution}`}>
                {t.institution}: {t.n.toLocaleString('en-CA')}
              </li>
            ))}
          </ul>
        </section>
      )}
      {counts && counts.recent.length > 0 && (
        <p className="text-sm text-slate-700">Recently signed: {counts.recent.map((r) => `${r.name}${r.province ? ` (${r.province})` : ''}`).join(', ')}</p>
      )}
    </div>
  )
}
