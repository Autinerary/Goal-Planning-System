/**
 * Server-side geocoding via OpenStreetMap Nominatim (free, no API key).
 *
 * The ResourceHub "nearest to you" / distance features need the user's
 * lat/lng. Goal-planning onboarding only collects city/province/country as
 * plain text, so we geocode it here when completing onboarding.
 *
 * Nominatim usage policy: max 1 req/sec, a descriptive User-Agent is required.
 * This runs once per onboarding completion, well within limits.
 */

export interface GeocodeInput {
  city?: string
  province?: string
  country?: string
  postal_code?: string
}

export async function geocodeLocation(loc: GeocodeInput): Promise<{ lat: number; lng: number } | null> {
  const parts = [loc.city, loc.province, loc.postal_code, loc.country].map((p) => (p || '').trim()).filter(Boolean)
  if (parts.length === 0) return null
  const q = parts.join(', ')

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: {
        // Nominatim requires a descriptive UA identifying the app.
        'User-Agent': 'Autinerary-ResourceHub/1.0 (onboarding geocoder)',
        'Accept-Language': 'en',
      },
      // Never let a slow geocoder block onboarding.
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
    // Timeouts / network errors just mean no coords — distance features degrade
    // gracefully (they only kick in when lat/lng are present).
    return null
  }
}
