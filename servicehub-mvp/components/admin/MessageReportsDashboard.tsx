'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Flag, RefreshCw } from 'lucide-react'

/**
 * Reported messages from Hare World (STEPs 66 and 67). Each report has a
 * copy of the message, kept even if the sender unsent it, and the reporter's
 * reason. The team writes what was done and marks it resolved, or bans the
 * sender (Admin, then Users does the same). Only the reported message is
 * shown, not the rest of the conversation, which stays private.
 */

type Person = { id: string; name: string; email: string | null; role: string | null }
type Report = {
  id: string
  content: string | null
  reason: string | null
  created_at: string
  unsent: boolean
  reporter: Person | null
  reported: Person | null
  times_reported: number
  resolved_at: string | null
  resolved_by: Person | null
  resolution: string | null
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '')

export default function MessageReportsDashboard() {
  const [filter, setFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [data, setData] = useState<{ available: boolean; canWriteResolution?: boolean; counts: { open: number; resolved: number }; reports: Report[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [status, setStatus] = useState('')

  const load = useCallback(() => {
    setFailed(false)
    fetch(`/api/admin/message-reports?status=${filter}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true))
  }, [filter])
  useEffect(() => { load() }, [load])

  const resolve = async (report: Report, resolved: boolean, resolution = '') => {
    const res = await fetch('/api/admin/message-reports', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: report.id, resolved, resolution }) })
    const json = await res.json().catch(() => ({}))
    setStatus(res.ok ? (resolved ? 'Marked as resolved.' : 'Reopened.') : json.error || 'That could not be saved.')
    if (res.ok) load()
  }

  const setRole = async (person: Person, role: 'banned' | 'user') => {
    if (role === 'banned' && !confirm(`Ban ${person.name}? They will no longer be able to message anyone or use Tidbits.`)) return
    const res = await fetch(`/api/admin/users/${person.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) })
    const json = await res.json().catch(() => ({}))
    setStatus(res.ok ? (role === 'banned' ? `${person.name} is banned.` : `${person.name} is no longer banned.`) : json.error || 'That could not be saved.')
    if (res.ok) load()
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Admin Dashboard
      </Link>
      <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Flag className="h-8 w-8 text-red-700" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-gray-900">Reported messages</h1>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
        </button>
      </div>
      <p className="mb-6 text-gray-700">
        Messages in Hare World that the person who got them reported. You see the reported message only, not the rest of
        the conversation. Write what you did when you resolve one.
      </p>

      {data && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <div className="rounded-lg border border-gray-200 bg-white p-4"><div className="text-sm text-gray-700">Open</div><div className="text-2xl font-bold text-red-700">{data.counts.open}</div></div>
          <div className="rounded-lg border border-gray-200 bg-white p-4"><div className="text-sm text-gray-700">Resolved</div><div className="text-2xl font-bold text-green-700">{data.counts.resolved}</div></div>
        </div>
      )}

      <div role="group" aria-label="Show" className="mb-6 flex gap-2">
        {(['open', 'resolved', 'all'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 font-medium ${filter === f ? 'bg-blue-700 text-white' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-100'}`}
          >
            {f === 'open' ? 'Open' : f === 'resolved' ? 'Resolved' : 'All'}
          </button>
        ))}
      </div>

      <p role="status" className="mb-4 text-sm text-gray-800">{status}</p>

      {failed && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">The reports could not be loaded.</p>}
      {!data && !failed && <p className="text-gray-700">Loading…</p>}
      {data && !data.available && <p className="rounded-lg border border-gray-200 bg-white p-6 text-gray-800">Reporting isn’t switched on yet (STEP 66).</p>}
      {data?.available && data.reports.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-700">{filter === 'open' ? 'Nothing to review.' : 'No reports.'}</p>
      )}

      <ul className="space-y-4">
        {data?.reports.map((r) => (
          <ReportCard key={r.id} report={r} canWriteResolution={Boolean(data.canWriteResolution)} onResolve={resolve} onRole={setRole} />
        ))}
      </ul>
    </div>
  )
}

function PersonLine({ label, person }: { label: string; person: Person | null }) {
  if (!person) return <p className="text-sm text-gray-800"><span className="font-semibold">{label}:</span> deleted account</p>
  return (
    <p className="text-sm text-gray-800">
      <span className="font-semibold">{label}:</span> {person.name}
      {person.email ? <span className="text-gray-700"> ({person.email})</span> : null}
      {person.role === 'banned' && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Banned</span>}
    </p>
  )
}

function ReportCard({ report: r, canWriteResolution, onResolve, onRole }: {
  report: Report
  canWriteResolution: boolean
  onResolve: (r: Report, resolved: boolean, resolution?: string) => void
  onRole: (p: Person, role: 'banned' | 'user') => void
}) {
  const [note, setNote] = useState('')
  const noteId = `resolution-${r.id}`
  return (
    <li className={`rounded-lg border bg-white p-5 ${r.resolved_at ? 'border-gray-200' : 'border-red-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm text-gray-700">Reported {when(r.created_at)}{r.unsent ? ' · the sender has since unsent it' : ''}</p>
        {r.resolved_at
          ? <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">Resolved</span>
          : <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">Open</span>}
      </div>
      <blockquote className="my-3 whitespace-pre-wrap break-words rounded-lg border-l-4 border-red-300 bg-gray-50 p-3 text-gray-900">
        {r.content || '(no copy)'}
      </blockquote>
      <p className="text-sm text-gray-800"><span className="font-semibold">Reason given:</span> {r.reason || 'none'}</p>
      <PersonLine label="Sent by" person={r.reported} />
      {r.reported && r.times_reported > 1 && <p className="text-sm font-semibold text-red-800">Reported {r.times_reported} times in all.</p>}
      <PersonLine label="Reported by" person={r.reporter} />

      {r.resolved_at ? (
        <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-gray-900">
          <p><span className="font-semibold">Resolved</span> {when(r.resolved_at)}{r.resolved_by ? ` by ${r.resolved_by.name}` : ''}.</p>
          {r.resolution && <p className="mt-1">{r.resolution}</p>}
          <button type="button" onClick={() => onResolve(r, false)} className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50">Reopen</button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onResolve(r, true, note || 'Resolved') }} className="mt-4 space-y-2">
          {canWriteResolution && (
            <>
              <label htmlFor={noteId} className="block text-sm font-semibold text-gray-900">What you did</label>
              <input id={noteId} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="For example: talked to them; no further action" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={canWriteResolution && !note.trim()} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50">Mark as resolved</button>
            {r.reported && r.reported.role !== 'banned' && r.reported.role !== 'admin' && (
              <button type="button" onClick={() => onRole(r.reported!, 'banned')} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50">Ban the sender</button>
            )}
            {r.reported?.role === 'banned' && (
              <button type="button" onClick={() => onRole(r.reported!, 'user')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50">Lift the ban</button>
            )}
          </div>
        </form>
      )}
    </li>
  )
}
