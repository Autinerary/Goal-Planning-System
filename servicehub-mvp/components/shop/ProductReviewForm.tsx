'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { showToast } from '@/lib/toast'

/**
 * Rate a product (Odosa: "currently unable to rate a product").
 *
 * There was no review UI and no write route — product_reviews was read-only in
 * practice. The per-norm scores are optional: asking for them is what lets the
 * breakdown above say "people with this norm rated it X", but a plain star
 * rating must never be blocked behind them.
 */

const NORMS: { key: string; label: string }[] = [
  { key: 'sensory', label: 'Sensory comfort' },
  { key: 'mobility', label: 'Physical accessibility' },
  { key: 'cognitive', label: 'Ease of understanding' },
]

export default function ProductReviewForm({
  productId,
  signedIn,
  existingRating,
}: {
  productId: string
  signedIn: boolean
  existingRating?: number
}) {
  const router = useRouter()
  const [rating, setRating] = useState(existingRating ?? 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)

  if (!signedIn) {
    return (
      <p className="text-sm text-gray-500">
        <a href="/login" className="text-purple-700 font-medium hover:underline">Sign in</a>{' '}
        to rate this product.
      </p>
    )
  }

  const submit = async () => {
    if (rating < 1) {
      showToast.error('Pick a star rating first.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/shop/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment, barrier_scores: scores }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || 'Could not save your review')
      }
      showToast.success(existingRating ? 'Review updated.' : 'Thanks — your review is live.')
      // Refresh so the breakdown above reflects this review immediately.
      router.refresh()
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not save your review')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-gray-900 mb-1.5">Your rating</div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  n <= (hover || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-medium text-gray-900 mb-1.5">
          How did it do on these? <span className="font-normal text-gray-500">(optional)</span>
        </div>
        <div className="space-y-2">
          {NORMS.map((n) => (
            <div key={n.key} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700">{n.label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-label={`${n.label}: ${v} of 5`}
                    onClick={() => setScores((s) => ({ ...s, [n.key]: v }))}
                    className={`w-7 h-7 rounded text-xs font-medium border transition-colors ${
                      scores[n.key] === v
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="product-review" className="block text-sm font-medium text-gray-900 mb-1.5">
          Anything worth telling people? <span className="font-normal text-gray-500">(optional)</span>
        </label>
        <textarea
          id="product-review"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="What worked, what didn't, anything a listing wouldn't tell you."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={busy || rating < 1}
        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Saving…' : existingRating ? 'Update review' : 'Post review'}
      </button>
      {rating < 1 && (
        <p className="text-xs text-gray-500">Pick a star rating to post.</p>
      )}
    </div>
  )
}
