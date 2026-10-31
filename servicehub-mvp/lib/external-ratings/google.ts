// Google's rating for a listing, shown beside (never mixed into) the community's: ResourceHub has no real ratings yet
// (30 October 2026: 2 of 521 were from real people), and a service's Google rating is real, public information.
//
// Google's Places terms decide the shape of this:
//   - only the place_id may be stored; a rating can't be cached, so it is fetched when someone looks, every time;
//   - it is shown with Google's attribution and apart from our own ratings (components/resources/detail/GoogleRating.tsx);
//   - so it is never copied into ratings, recommendation_ratings, a score, or a search index.
// Off unless GOOGLE_RATINGS=on and GOOGLE_PLACES_API_KEY is set. Read https://developers.google.com/maps/documentation/places/web-service/policies
// before switching it on.

const BASE = 'https://places.googleapis.com/v1'

export interface Lookup {
  name: string
  city?: string | null
  province?: string | null
}
export interface GoogleRating {
  rating: number
  count: number
  mapsUri: string | null
}

export function googleRatingsOn(env: Record<string, string | undefined> = process.env): boolean {
  return env.GOOGLE_RATINGS === 'on' && !!env.GOOGLE_PLACES_API_KEY
}

const words = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 2 && !['the', 'and', 'inc', 'ltd'].includes(w))

/** True when a Google place is plausibly this listing: most of the listing's name words are in the place's name, and the province or city agrees. */
export function sameService(listing: Lookup, place: { displayName?: { text?: string }; formattedAddress?: string }): boolean {
  const a = new Set(words(listing.name)), b = new Set(words(place.displayName?.text || ''))
  if (!a.size || !b.size) return false
  // Most of the LISTING's words must be in the place's name: a program page named for its organisation ("Awards and
  // Funding (Autism Ontario)") is not that organisation's place, and shouldn't show its rating.
  const shared = [...a].filter((w) => b.has(w)).length
  const nameOk = shared / a.size >= 0.6
  const addr = (place.formattedAddress || '').toLowerCase()
  const placeOk = (!!listing.city && addr.includes(listing.city.toLowerCase())) || (!!listing.province && new RegExp(`\\b${listing.province.toLowerCase()}\\b`).test(addr))
  return nameOk && placeOk
}

/** The place id for a listing (the one thing we may keep), or null when none matches. Costs one "IDs only" search. */
export async function findPlaceId(listing: Lookup, key: string, fetchFn: typeof fetch = fetch): Promise<string | null> {
  const query = [listing.name, listing.city, listing.province, 'Canada'].filter(Boolean).join(' ')
  const res = await fetchFn(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 3, regionCode: 'CA' }),
  })
  if (!res.ok) return null
  const body = await res.json().catch(() => ({}))
  const hit = (body.places || []).find((p: any) => p?.id && sameService(listing, p))
  return hit ? String(hit.id) : null
}

/** Google's rating for a place, fetched now; null when it has none. Never stored. */
export async function fetchGoogleRating(placeId: string, key: string, fetchFn: typeof fetch = fetch): Promise<GoogleRating | null> {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(placeId)) return null
  const res = await fetchFn(`${BASE}/places/${placeId}`, { headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri' } })
  if (!res.ok) return null
  const b = await res.json().catch(() => ({}))
  if (typeof b.rating !== 'number' || !b.userRatingCount) return null
  return { rating: b.rating, count: b.userRatingCount, mapsUri: typeof b.googleMapsUri === 'string' && b.googleMapsUri.startsWith('https://') ? b.googleMapsUri : null }
}
