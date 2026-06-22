'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldAlert, Trash2, Lock, Check, X } from 'lucide-react'
import type {
  CommunityReportEnriched,
  ResolveReportPayload,
} from '@/types/community'

export default function AdminCommunityPage() {
  const [reports, setReports] = useState<CommunityReportEnriched[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/community/admin/reports')
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Load failed (${res.status})`)
      }
      const j = await res.json()
      setReports(j.reports ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const resolve = async (id: string, payload: ResolveReportPayload) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/community/admin/reports/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Resolve failed (${res.status})`)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Admin home
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-amber-600" />
        Tidbits moderation
      </h1>
      <p className="text-sm text-gray-600">
        Open reports surface here. Resolve each by keeping, removing, or warning. You can also
        lock posts to stop new replies.
      </p>

      {loading && <p className="text-sm text-gray-500">Loading…</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!loading && reports.length === 0 && (
        <p className="text-sm text-gray-500">No open reports. The queue is clear.</p>
      )}

      <ul className="space-y-3">
        {reports.map((r) => {
          const isOpen = r.status === 'open'
          return (
            <li
              key={r.id}
              className={`rounded-2xl border p-4 ${
                isOpen ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center flex-wrap gap-2 mb-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold ${
                    isOpen
                      ? 'bg-amber-600 text-white'
                      : r.status === 'resolved_removed'
                      ? 'bg-rose-100 text-rose-700'
                      : r.status === 'resolved_kept'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {r.status}
                </span>
                <span className="text-gray-500">
                  reported by{' '}
                  <span className="font-medium">{r.reporter_pseudonym ?? 'unknown'}</span> ·{' '}
                  {new Date(r.created_at).toLocaleString()}
                </span>
                <span className="ml-auto text-gray-500">
                  Target: <span className="font-medium">{r.target_type}</span>
                </span>
              </div>
              {r.target_title && (
                <div className="text-sm font-medium text-gray-900 mb-1">
                  {r.target_type === 'post' ? (
                    <Link
                      href={`/community/post/${r.target_id}`}
                      className="text-blue-700 hover:underline"
                    >
                      {r.target_title}
                    </Link>
                  ) : (
                    r.target_title
                  )}
                </div>
              )}
              {r.target_excerpt && (
                <p className="text-xs text-gray-600 line-clamp-3 mb-2 italic">"{r.target_excerpt}"</p>
              )}
              {r.target_author_pseudonym && (
                <p className="text-xs text-gray-500 mb-2">
                  Author:{' '}
                  <Link
                    href={`/community/profile/${r.target_author_id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {r.target_author_pseudonym}
                  </Link>
                </p>
              )}
              <div className="rounded-lg bg-white border border-gray-200 p-3 text-sm text-gray-800 mb-3">
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Reason
                </span>
                {r.reason}
              </div>
              {!isOpen && r.resolution_note && (
                <p className="text-xs text-gray-500">
                  Resolution note: <em>{r.resolution_note}</em>
                </p>
              )}
              {isOpen && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => resolve(r.id, { status: 'resolved_kept' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> Keep
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() =>
                      resolve(r.id, {
                        status: 'resolved_removed',
                        remove_target: true,
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                  {r.target_type === 'post' && (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() =>
                        resolve(r.id, {
                          status: 'resolved_warned',
                          lock_post: true,
                          note: 'Locked due to report',
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Lock className="w-3.5 h-3.5" /> Lock & warn
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => resolve(r.id, { status: 'resolved_kept', note: 'Dismissed' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" /> Dismiss
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
