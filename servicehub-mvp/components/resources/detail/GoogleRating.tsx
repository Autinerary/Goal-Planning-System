'use client'

import { useEffect, useState } from 'react'

interface Rating { rating: number; count: number; mapsUri: string | null }

/**
 * Google's rating for this service, fetched live and shown apart from the community's ratings, with attribution
 * (Google's Places policy: https://developers.google.com/maps/documentation/places/web-service/policies). Shows nothing
 * when the feature is off, Google has no rating, or the request fails. Never part of any average or ranking here.
 */
export default function GoogleRating({ resourceId }: { resourceId: string }) {
  const [r, setR] = useState<Rating | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/resources/${resourceId}/google-rating`, { cache: 'no-store' })
      .then((res) => (res.status === 200 ? res.json() : null))
      .then((b) => live && b && typeof b.rating === 'number' && setR(b))
      .catch(() => {})
    return () => { live = false }
  }, [resourceId])
  if (!r) return null
  return (
    <section aria-label="Rating from Google" className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">Rated on Google</h2>
      <p className="mt-1 text-gray-800">
        <span className="text-xl font-semibold">{r.rating.toFixed(1)}</span> out of 5, from {r.count.toLocaleString('en-CA')} Google reviews
      </p>
      <p className="mt-1 text-sm text-gray-600">
        This is Google's rating, not ours: it comes from people outside Autinerary and isn't part of the community ratings above.{' '}
        {r.mapsUri ? <a className="underline" href={r.mapsUri} target="_blank" rel="noopener noreferrer">Google Maps</a> : <span>Google Maps</span>}
      </p>
    </section>
  )
}
