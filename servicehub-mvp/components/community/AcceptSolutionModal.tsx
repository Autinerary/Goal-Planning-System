'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import {
  validateSolvedPayload,
  KEY_INSIGHT_MAX,
  TLDR_MAX,
} from '@/lib/community/solved'

interface AcceptSolutionModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (key_insight: string, tldr: string) => Promise<void> | void
  answerExcerpt?: string
}

/**
 * Modal that captures the MANDATORY Solved line (key insight + TL;DR)
 * before accepting an answer. Submit is disabled until validation passes.
 */
export default function AcceptSolutionModal({
  open,
  onClose,
  onSubmit,
  answerExcerpt,
}: AcceptSolutionModalProps) {
  const [keyInsight, setKeyInsight] = useState('')
  const [tldr, setTldr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const validation = validateSolvedPayload(keyInsight, tldr)

  const handleSubmit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(keyInsight.trim(), tldr.trim())
      // Reset so the next open is clean.
      setKeyInsight('')
      setTldr('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mark as solution"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 bg-emerald-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <h2 className="font-semibold">Mark this as the solution</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="opacity-80 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-700">
            To keep the community valuable, please summarise <em>why</em> this answer worked. Both
            fields are required — they will show at the top of your post so others can learn from
            it.
          </p>
          {answerExcerpt && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 line-clamp-3">
              {answerExcerpt}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Key insight <span className="text-rose-600">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-1">
              The one sentence that captures the moment it clicked.
            </p>
            <input
              type="text"
              value={keyInsight}
              onChange={(e) => setKeyInsight(e.target.value)}
              maxLength={KEY_INSIGHT_MAX}
              placeholder="e.g. Switching to a written script let me focus on the next step."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {keyInsight.length} / {KEY_INSIGHT_MAX}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              TL;DR <span className="text-rose-600">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-1">1-3 sentences that summarise what to do.</p>
            <textarea
              value={tldr}
              onChange={(e) => setTldr(e.target.value)}
              maxLength={TLDR_MAX}
              placeholder="e.g. Practice the call in front of a mirror until the script feels natural. Make the call when you're calm, not after coffee. If you freeze, just hang up and try again."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[120px]"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {tldr.length} / {TLDR_MAX}
            </p>
          </div>
          {validation && (
            <p className="text-xs text-rose-600" role="alert">
              {validation}
            </p>
          )}
          {error && (
            <p className="text-sm text-rose-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!!validation || submitting}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Accepting…' : 'Mark as solution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
