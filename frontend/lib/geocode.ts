/**
 * Server-side geocoding via OpenStreetMap Nominatim (free, no API key).
 *
 * Same lookup as servicehub-mvp/lib/geocode.ts. The two apps are separate
 * Next.js projects with no shared package, so it is repeated here rather than
 * imported; keep them in step.
 *
 * Nominatim usage policy: max 1 req/sec, a descriptive User-Agent is required.
 * This runs once per onboarding, well within limits.
 */

export interface GeocodeInput {
  city?: string
  province?: string
  country?: string
}

export async function geocodeLocation(loc: GeocodeInput): Promise<{ lat: number; lng: number } | null> {
  const parts = [loc.city, loc.province, loc.country].map((p) => (p || '').trim()).filter(Boolean)
  if (parts.length === 0) return null
  const q = parts.join(', ')

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Autinerary-GoalPlanning/1.0 (onboarding geocoder)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const first = Array.isArray(data) ? data[0] : null
    if (!first?.lat || !first?.lon) return null
    const lat = Number(first.lat)
    const lng = Number(first.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null
    return { lat, lng }
  } catch {
    return null
  }
}
