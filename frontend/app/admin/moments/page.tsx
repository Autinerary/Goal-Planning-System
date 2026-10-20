'use client'

import { useEffect, useState } from 'react'
import BackButton from '../../components/BackButton'

interface Row {
  id: string
  kind: string
  title: string
  caption: string | null
  media_url: string | null
  media_type: 'image' | 'video' | null
  visibility: string
  review_status: string
  report_count: number
  hidden: boolean
  created_at: string
  by: { name: string; icon: string } | null
  reasons: string[]
}

/**
 * The team's review of Hare World Social (STEP 87; admins only): moments
 * shared with everyone, shown once someone here has looked, and moments
 * reported (two reports hide one until it's looked at).
 */
export default function MomentsReviewPage() {
  const [data, setData] = useState<{ waiting: Row[]; reported: Row[] } | null>(null)
  const [error, setError] = useState('')

  const load = () =>
    fetch('/api/admin/moments', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (!r.ok) throw new Error(d?.error || 'Could not load.')
        if (d.available === false) throw new Error('Hare World Social isn’t in the database yet (STEP 87).')
        setData({ waiting: d.waiting, reported: d.reported })
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load.'))

  useEffect(() => {
    load()
  }, [])

  const act = async (id: string, action: 'approve' | 'reject' | 'unhide' | 'hide') => {
    const r = await fetch('/api/admin/moments', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    if (!r.ok) setError('That didn’t save.')
    load()
  }

  const card = (m: Row, actions: [string, 'approve' | 'reject' | 'unhide' | 'hide'][]) => (
    <li key={m.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
      {m.media_url ? (
        m.media_type === 'video' ? (
          <video src={m.media_url} controls className="h-48 w-full rounded-lg bg-black sm:w-64" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={m.media_url} alt="" className="h-48 w-full rounded-lg bg-slate-100 object-contain sm:w-64" />
        )
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-700">
          {m.by ? `${m.by.icon} ${m.by.name}` : 'Someone'} · {m.kind} · {new Date(m.created_at).toLocaleString()} · shared with {m.visibility}
          {m.hidden ? ' · hidden' : ''}
        </p>
        <h2 className="font-semibold text-slate-900">{m.title}</h2>
        {m.caption && <p className="mt-1 whitespace-pre-line text-sm text-slate-900">{m.caption}</p>}
        {m.reasons.length > 0 && (
          <p className="mt-2 text-sm text-red-900">
            Reported {m.report_count}×: {m.reasons.join(' · ')}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map(([label, action]) => (
            <button key={action} type="button" onClick={() => act(m.id, action)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${action === 'approve' || action === 'unhide' ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'border border-slate-300 text-slate-900 hover:bg-slate-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </li>
  )

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <BackButton fallback="/path" />
        <h1 className="text-2xl font-bold text-slate-900">Hare World Social: review</h1>
        <p className="text-sm text-slate-800">Look for faces or names of other people without their OK, anything unsafe or hurtful, and anything that isn’t about someone’s own journey.</p>
        {error && <p role="alert" className="text-red-800">{error}</p>}
        {!data && !error && <p className="text-slate-700">Loading…</p>}
        {data && (
          <>
            <section aria-labelledby="waiting">
              <h2 id="waiting" className="text-lg font-bold text-slate-900">
                Waiting to be shown to everyone ({data.waiting.length})
              </h2>
              {data.waiting.length === 0 ? <p className="mt-2 text-sm text-slate-700">Nothing waiting.</p> : <ul className="mt-2 space-y-3">{data.waiting.map((m) => card(m, [['Show it to everyone', 'approve'], ['Don’t', 'reject']]))}</ul>}
            </section>
            <section aria-labelledby="reported">
              <h2 id="reported" className="text-lg font-bold text-slate-900">
                Reported ({data.reported.length})
              </h2>
              {data.reported.length === 0 ? (
                <p className="mt-2 text-sm text-slate-700">Nothing reported.</p>
              ) : (
                <ul className="mt-2 space-y-3">{data.reported.map((m) => card(m, m.hidden ? [['It’s fine: show it again', 'unhide']] : [['Hide it', 'hide']]))}</ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
