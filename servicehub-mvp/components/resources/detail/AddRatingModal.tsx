'use client'

import { useState } from 'react'
import { X, Star } from 'lucide-react'
import { showToast } from '@/lib/toast'
import { formatErrorForUser } from '@/lib/errors/handler'
import type { BarrierScores } from '@/types/database'

interface AddRatingModalProps {
  resourceId: string
  onClose: () => void
  onRatingAdded: () => void
}

const barrierTypes = [
  { key: 'sensory', label: 'Sensory' },
  { key: 'mobility', label: 'Mobility' },
  { key: 'communication', label: 'Communication' },
  { key: 'cognitive', label: 'Cognitive' },
  { key: 'social', label: 'Social' },
]

export default function AddRatingModal({ resourceId, onClose, onRatingAdded }: AddRatingModalProps) {
  const [overallRating, setOverallRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [barrierScores, setBarrierScores] = useState<BarrierScores>({})
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (overallRating === 0) {
      setError('Please select an overall rating')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const response = await fetch(`/api/resources/${resourceId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overall_score: overallRating,
          barrier_scores: Object.keys(barrierScores).length > 0 ? barrierScores : undefined,
          comment: comment.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        const formattedError = formatErrorForUser(
          new Error(data.error || 'Failed to submit rating')
        )
        throw new Error(formattedError.message)
      }

      const result = await response.json()
      showToast.success(
        result.validation?.decision === 'flag_for_review'
          ? 'Rating submitted and is pending review'
          : 'Rating submitted successfully!'
      )
      onRatingAdded()
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to submit rating. Please try again.'
      setError(errorMessage)
      showToast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const handleBarrierScoreChange = (barrier: string, score: number) => {
    setBarrierScores((prev) => ({ ...prev, [barrier]: score }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold text-gray-900">Add Your Rating</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Overall Rating */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Overall Rating <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setOverallRating(rating)}
                  onMouseEnter={() => setHoveredRating(rating)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  aria-label={`Rate ${rating} stars`}
                >
                  <Star
                    className={`w-8 h-8 ${
                      rating <= (hoveredRating || overallRating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
              {overallRating > 0 && (
                <span className="ml-2 text-sm text-gray-600">
                  {overallRating} {overallRating === 1 ? 'star' : 'stars'}
                </span>
              )}
            </div>
          </div>

          {/* Barrier-Specific Scores (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              Barrier-Specific Ratings <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <div className="space-y-4">
              {barrierTypes.map((barrier) => (
                <div key={barrier.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">{barrier.label}</span>
                    {barrierScores[barrier.key] && (
                      <span className="text-xs text-gray-500">
                        {barrierScores[barrier.key]}/5
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => handleBarrierScoreChange(barrier.key, score)}
                        className={`w-6 h-6 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          barrierScores[barrier.key] >= score
                            ? 'bg-blue-600 border-blue-600'
                            : 'bg-white border-gray-300 hover:border-blue-400'
                        }`}
                        aria-label={`Rate ${barrier.label} ${score} out of 5`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-900 mb-2">
              Your Review <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Share your experience with this resource..."
              maxLength={2000}
            />
            <div className="mt-1 text-xs text-gray-500 text-right">
              {comment.length}/2000 characters
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || overallRating === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Rating'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}