'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'

interface ReportButtonProps {
  targetType: 'post' | 'answer' | 'user'
  targetId: string
  className?: string
}

export default function ReportButton({ targetType, targetId, className }: ReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/community/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `Report failed (${res.status})`)
      }
      setDone(true)
      setTimeout(() => setOpen(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Report failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setDone(false)
          setReason('')
          setError(null)
        }}
        className={`inline-flex items-center gap-1 text-xs text-gray-500 hover:text-rose-600 ${className ?? ''}`}
      >
        <Flag className="w-3.5 h-3.5" />
        <span>Report</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report content"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900">Report this {targetType}</h2>
            <p className="text-sm text-gray-600">
              Tell our moderators what's wrong. They'll review and take action.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you reporting this? (5-1000 characters)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              maxLength={1000}
              minLength={5}
              disabled={submitting || done}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {done ? (
              <p className="text-sm text-emerald-700">Thanks — report received.</p>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg text-gray-700 hover:bg-gray-100"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  onClick={submit}
                  disabled={submitting || reason.trim().length < 5}
                >
                  {submitting ? 'Reporting…' : 'Report'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
