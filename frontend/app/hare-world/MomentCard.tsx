'use client'

import { useState } from 'react'
import { Flag, Heart, Trash2 } from 'lucide-react'
import { VISIBILITY, visibilityLabel, type Moment, type MomentVisibility } from '@/lib/moments'

/**
 * One moment in Hare World Social or your Memories: its photo or video, the
 * task or milestone it marks, its caption, and cheers. Yours can change who
 * sees it or be deleted; others' can be cheered or reported.
 */
export default function MomentCard({ moment, onChange, onRemove }: { moment: Moment; onChange?: (m: Moment) => void; onRemove?: (id: string) => void }) {
  const [m, setM] = useState(moment)
  const [busy, setBusy] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState('')

  const update = (next: Moment) => {
    setM(next)
    onChange?.(next)
  }

  const cheer = async () => {
    if (busy || m.mine) return
    setBusy(true)
    const on = !m.cheered
    update({ ...m, cheered: on, cheers: Math.max(0, m.cheers + (on ? 1 : -1)) })
    const res = await fetch(`/api/moments/${m.id}/cheer`, { method: on ? 'POST' : 'DELETE', credentials: 'include' }).catch(() => null)
    const d = await res?.json().catch(() => null)
    if (!res?.ok) update(m)
    else if (typeof d?.cheers === 'number') update({ ...m, cheered: on, cheers: d.cheers })
    setBusy(false)
  }

  const share = async (visibility: MomentVisibility) => {
    setStatus('')
    const res = await fetch('/api/moments', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id, visibility }) })
    const d = await res.json().catch(() => null)
    if (!res.ok) return setStatus(d?.error || 'That didn’t save.')
    update({ ...m, visibility, review_status: d?.review_status || m.review_status })
    setStatus(visibility === 'everyone' ? 'Saved. It shows to everyone once the team has looked at it.' : 'Saved.')
  }

  const remove = async () => {
    if (!window.confirm('Delete this moment and its photo or video?')) return
    const res = await fetch('/api/moments', { method: 'DELETE', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
    if (res.ok) onRemove?.(m.id)
    else setStatus('That didn’t work. Please try again.')
  }

  const report = async () => {
    const res = await fetch(`/api/moments/${m.id}/report`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    setReporting(false)
    setStatus(res.ok ? 'Thanks. The team will look at it.' : 'That didn’t work. Please try again.')
  }

  const when = new Date(m.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-moment={m.id}>
      {m.media_url ? (
        m.media_type === 'video' ? (
          <video src={m.media_url} controls playsInline preload="metadata" className="aspect-[4/5] w-full bg-black object-contain" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={m.media_url} alt={`Photo for ${m.title}`} loading="lazy" className="aspect-[4/5] w-full bg-slate-100 object-cover" />
        )
      ) : null}
      <div className="p-4">
        <p className="text-xs text-slate-700">
          {m.by ? (
            <span className="font-semibold text-slate-900">
              {m.by.icon} {m.by.name}
            </span>
          ) : (
            <span className="font-semibold text-slate-900">You</span>
          )}{' '}
          · {m.kind === 'milestone' ? 'Milestone' : 'Task'} · {when}
        </p>
        <h3 className="mt-1 font-bold text-slate-900">{m.title}</h3>
        {m.caption && <p className="mt-2 whitespace-pre-line text-sm text-slate-900">{m.caption}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={cheer}
            disabled={m.mine || busy}
            aria-pressed={m.cheered}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold ${m.cheered ? 'border-pink-600 bg-pink-50 text-pink-900' : 'border-slate-300 text-slate-900 hover:bg-slate-50'} disabled:opacity-80`}
          >
            <Heart className={`h-4 w-4 ${m.cheered ? 'fill-current' : ''}`} aria-hidden="true" /> {m.cheers} {m.cheers === 1 ? 'cheer' : 'cheers'}
          </button>
          {m.mine ? (
            <>
              <label className="text-sm text-slate-900">
                <span className="sr-only">Who can see it</span>
                <select value={m.visibility} onChange={(e) => share(e.target.value as MomentVisibility)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm">
                  {VISIBILITY.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              {m.visibility === 'everyone' && m.review_status === 'pending' && <span className="text-xs text-slate-700">Waiting for the team</span>}
              {m.visibility === 'everyone' && m.review_status === 'rejected' && <span className="text-xs text-slate-700">Not shown to everyone</span>}
              {m.hidden && <span className="text-xs text-red-800">Hidden after reports; the team will look</span>}
              <button type="button" onClick={remove} aria-label={`Delete the moment for ${m.title}`} className="ml-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-red-700">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setReporting(!reporting)} aria-expanded={reporting} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report
            </button>
          )}
        </div>
        {!m.mine && <p className="mt-1 text-xs text-slate-700">{visibilityLabel(m.visibility) === 'My people' ? 'Shared with their people' : 'Shared with everyone in Hare World'}</p>}
        {reporting && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <label htmlFor={`report-${m.id}`} className="block text-sm font-semibold text-slate-900">
              What’s wrong with it? (optional)
            </label>
            <textarea id={`report-${m.id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
            <button type="button" onClick={report} className="mt-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black">
              Report it
            </button>
          </div>
        )}
        {status && (
          <p role="status" className="mt-2 text-xs text-slate-800">
            {status}
          </p>
        )}
      </div>
    </article>
  )
}
