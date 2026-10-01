import type { SupabaseClient } from '@supabase/supabase-js'
import type { Location } from '@/types/database'

/**
 * Approved resources near a point, for the cold-start fallback.
 *
 * The fallback used to fetch 200 approved resources with no ORDER BY and no
 * location filter, then sort those 200 by distance. With the imported venues
 * approved, those 200 were whichever rows the table returned first: 193 of
 * them were in London, Ontario or Vancouver, so someone in Ottawa was shown
 * London parks as "nearest".
 *
 * Postgres cannot order by distance through PostgREST without an RPC, so this
 * narrows the query instead: a bounding box around the point (filtering on
 * location->lat / location->lng), smallest first, widening until the box
 * holds at least MIN_NEARBY resources. The caller still sorts by true
 * distance; the box only decides which rows are fetched.
 */

// Smallest first, so the box that is used holds the nearest resources.
// The steps past 1000 km are for remote users (Whitehorse has nothing within
// 1000 km). They stay fine-grained because a box that is too wide holds more
// than NEARBY_FETCH_LIMIT rows and the limit then cuts arbitrarily across it.
export const NEARBY_RADII_KM = [3, 10, 30, 100, 300, 1000, 1500, 2000, 3000]
export const MIN_NEARBY = 50
export const NEARBY_FETCH_LIMIT = 200

const KM_PER_DEGREE_LAT = 111

export async function fetchNearbyApprovedResources(
  supabase: SupabaseClient,
  location: Location
): Promise<{ resources: any[]; radiusKm: number | null }> {
  const { lat, lng } = location
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return { resources: [], radiusKm: null }
  }

  for (const km of NEARBY_RADII_KM) {
    const dLat = km / KM_PER_DEGREE_LAT
    // A degree of longitude shrinks with latitude; the floor avoids dividing by
    // ~0 near the poles.
    const dLng = km / (KM_PER_DEGREE_LAT * Math.max(Math.cos((lat * Math.PI) / 180), 0.01))
    const box = (columns: string, head: boolean) =>
      supabase
        .from('resources')
        .select(columns, head ? { count: 'exact', head: true } : undefined)
        .eq('status', 'approved')
        .gte('location->lat', lat - dLat)
        .lte('location->lat', lat + dLat)
        .gte('location->lng', lng - dLng)
        .lte('location->lng', lng + dLng)

    const { count, error } = await box('id', true)
    if (error) return { resources: [], radiusKm: null }
    if (!count) continue
    // Enough nearby, or this is the widest box and it holds something.
    if (count >= MIN_NEARBY || km === NEARBY_RADII_KM[NEARBY_RADII_KM.length - 1]) {
      const { data } = await box('*', false).limit(NEARBY_FETCH_LIMIT)
      return { resources: data || [], radiusKm: km }
    }
  }

  // Nothing at all within the widest radius: the caller falls back to the
  // unfiltered query rather than showing nothing.
  return { resources: [], radiusKm: null }
}
