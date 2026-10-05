'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookmarkCheck, Bookmark, Star } from 'lucide-react'
import CategoryIcon from '@/components/resources/CategoryIcon'
import { formatDistance } from '@/components/resources/ResourceCard'
import { findNeed } from '@/lib/onboarding/setup'
import type { MatchedPlace } from '@/lib/onboarding/first'

/** km that counts as near, as in search (NEAR_KM in lib/supabase/queries.ts). */
const NEAR_KM = 50

/**
 * How location shaped a list of matched places, said only as far as it is
 * true: places for the topic (national organisations, say) can come before
 * nearby ones, so "near Surrey, BC where possible", and plainly when none are.
 */
export function nearbyNote(places: MatchedPlace[], place: string | null): string {
  if (!place) return ''
  return places.some((p) => p.distance !== undefined && p.distance <= NEAR_KM)
    ? `, near ${place} where possible`
    : `. None are within ${NEAR_KM} km of ${place} yet`
}

/** Why a place was matched, in words its data supports. */
export function matchReason(place: MatchedPlace, topicLabel?: string | null): string {
  const need = place.needId ? findNeed(place.needId)?.label : undefined
  const parts: string[] = []
  if (place.reason === 'rated_for_topic' && topicLabel) parts.push(`Rated for ${topicLabel}`)
  if (place.reason === 'mentions_topic' && topicLabel) parts.push(`Mentions ${topicLabel}`)
  if (need) parts.push(need)
  if (place.reason === 'starter') parts.push('Support organisation')
  return parts.join(' · ')
}

/**
 * A place matched to what someone told ResourceHub, with why it is there,
 * where it is, and its reviews as they are (none is said plainly).
 */
export default function MatchedPlaceCard({
  place,
  topicLabel,
  fromSetup = false,
}: {
  place: MatchedPlace
  topicLabel?: string | null
  /** Opened from the end of setup, for the first-resource measure. */
  fromSetup?: boolean
}) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const href = place.kind === 'product' ? `/shop/${place.id}` : `/resources/${place.id}`
  const where = [place.city, place.province].filter(Boolean).join(', ')
  const reason = matchReason(place, topicLabel)

  function markFromSetup() {
    if (!fromSetup) return
    try {
      sessionStorage.setItem('rh_from_setup', '1')
    } catch {}
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/resources/${place.id}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (res.ok) setSaved(true)
      else setError('Could not save it. Please try again.')
    } catch {
      setError('Could not save it. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {reason && (
        <p className="mb-3 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
          {reason}
        </p>
      )}
      <div className="flex items-start gap-3">
        {place.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.imageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" loading="lazy" />
        ) : (
          <CategoryIcon category={place.category} size="sm" />
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900">
            <Link href={href} onClick={markFromSetup} className="hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded">
              {place.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-gray-600">
            {[place.category, where, place.distance !== undefined ? `${formatDistance(place.distance)} away` : '']
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-gray-600">
            {place.ratingCount > 0 ? (
              <>
                <Star className="h-4 w-4 fill-current text-yellow-400" aria-hidden="true" />
                {place.averageRating.toFixed(1)} from {place.ratingCount} {place.ratingCount === 1 ? 'review' : 'reviews'}
              </>
            ) : (
              'No reviews yet'
            )}
          </p>
        </div>
      </div>
      {place.description && <p className="mt-3 line-clamp-2 text-sm text-gray-600">{place.description}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href={href}
          onClick={markFromSetup}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Open
        </Link>
        {place.kind === 'place' &&
          (saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-800" role="status">
              <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
              Saved to your library
            </span>
          ) : (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
            >
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          ))}
        {error && (
          <span className="text-sm text-red-700" role="alert">
            {error}
          </span>
        )}
      </div>
    </article>
  )
}
