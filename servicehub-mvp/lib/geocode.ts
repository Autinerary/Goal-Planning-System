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

/**
 * Round a browser-reported coordinate to 2 decimal places (about 1 km).
 *
 * A phone's position can be precise to a few metres, which for most people
 * is their home. "Near you" needs nothing like that: the nearest search box
 * starts at 3 km. So only the rounded value is ever stored.
 */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The city / province / country for a coordinate, so a location set from the
 * browser can be shown as a place name. Null on any failure; the coordinates
 * still work without it.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string; province: string; country: string } | null> {
  try {
    // zoom=10 resolves to city level, not a street address.
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lng}`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Autinerary-ResourceHub/1.0 (location prompt)',
        'Accept-Language': 'en',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const a = data?.address || {}
    const city = a.city || a.town || a.village || a.municipality || a.county || ''
    if (!city && !a.state) return null
    return { city, province: a.state || '', country: a.country || '' }
  } catch {
    return null
  }
}
