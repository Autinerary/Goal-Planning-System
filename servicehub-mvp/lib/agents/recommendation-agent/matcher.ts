import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getRatingsByResource, ratingStats } from '@/lib/supabase/queries'
import { isSelfListing } from '@/lib/resources/selfListing'
import type { SimilarUser, CandidateResource, Resource, Location } from './types'
import { fetchNearbyApprovedResources, NEARBY_FETCH_LIMIT } from './nearby'

/**
 * Get candidate resources rated highly by similar users
 */
export async function getCandidateResources(
  similarUsers: SimilarUser[],
  location?: Location,
  limit: number = 100
): Promise<CandidateResource[]> {
  if (similarUsers.length === 0) {
    return []
  }

  const supabase = createClient()
  const similarUserIds = similarUsers.map((u) => u.user_id)

  try {
    // Get ratings from similar users (only high ratings: 4+ stars)
    // Without test, QA, seed and synthetic accounts (STEP 93); before the STEP, the ratings table as it was.
    let { data: ratings, error } = await supabase
      .from('recommendation_ratings')
      .select('resource_id, user_id, overall_score, barrier_scores')
      .in('user_id', similarUserIds)
      .gte('overall_score', 4)
      .limit(limit * 2) // Get more to filter later
    if (error) {
      ;({ data: ratings, error } = await supabase
        .from('ratings')
        .select('resource_id, user_id, overall_score, barrier_scores')
        .in('user_id', similarUserIds)
        .gte('overall_score', 4)
        .limit(limit * 2))
    }

    if (error || !ratings || ratings.length === 0) {
      return []
    }

    // Group ratings by resource
    const resourceRatingsMap = new Map<string, typeof ratings>()
    ratings.forEach((rating) => {
      if (!resourceRatingsMap.has(rating.resource_id)) {
        resourceRatingsMap.set(rating.resource_id, [])
      }
      resourceRatingsMap.get(rating.resource_id)!.push(rating)
    })

    // Get resource IDs
    const resourceIds = Array.from(resourceRatingsMap.keys()).slice(0, limit)

    // Fetch full resource data
    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')

    if (resourcesError || !resources) {
      return []
    }

    // Build candidate resources with metadata. Autinerary's own listing is
    // not a place to recommend (lib/resources/selfListing.ts).
    const candidates: CandidateResource[] = resources
      .filter((resource) => !isSelfListing(resource))
      .map((resource): CandidateResource => {
        const ratingsForResource = resourceRatingsMap.get(resource.id) || []
        const averageRating =
          ratingsForResource.length > 0
            ? ratingsForResource.reduce((sum, r) => sum + r.overall_score, 0) /
              ratingsForResource.length
            : 0

        return {
          resource,
          ratingsFromSimilarUsers: ratingsForResource,
          similarUsersCount: ratingsForResource.length,
          averageRating,
          basis: 'similar_people',
          ratingCount: ratingsForResource.length,
        }
      })

    // Filter by location if provided
    if (location && location.lat && location.lng) {
      // Sort by distance if location provided
      return withDistance(candidates, location).sort(nearestFirst).slice(0, limit)
    }

    return candidates.slice(0, limit)
  } catch (error) {
    console.error('Error getting candidate resources:', error)
    return []
  }
}

/**
 * Cold-start fallback: when there are no similar-user ratings yet (new user,
 * niche barrier profile, or the vector similarity search finds no neighbours),
 * recommend approved resources directly so the user always gets results.
 *
 * Ranks by community rating (avg overall score + rating volume) and, when a
 * location is provided, prefers nearby resources. Returns CandidateResource[]
 * shaped like the collaborative path so scoring/explanations work unchanged.
 */
export async function getFallbackCandidateResources(
  location?: Location,
  limit: number = 100
): Promise<CandidateResource[]> {
  const supabase = createClient()

  try {
    // With coordinates, fetch from around the user. Without them (or when
    // nothing approved is within NEARBY_RADII_KM) there is no "near" to use,
    // so take the best rated anywhere. Autinerary's own listing is left out
    // (lib/resources/selfListing.ts); the nearby lookup itself keeps it,
    // because "Near <city>" is browsing.
    let resources: any[] = []
    if (location?.lat && location?.lng) {
      resources = (await fetchNearbyApprovedResources(supabase, location)).resources.filter(
        (r) => !isSelfListing(r)
      )
    }
    if (resources.length === 0) {
      resources = await bestRatedApprovedResources(supabase, NEARBY_FETCH_LIMIT)
    }

    if (resources.length === 0) {
      return []
    }

    // Community ratings for these resources, from the shared index search
    // uses, which reads every rating. A single query stops at 1,000 rows, and
    // a count cut short would make a rated place's card say "Not rated yet".
    const stats = await recommenderRatingStats(supabase)

    // No ratings from similar people here, so the basis is the community
    // rating, and the score is not a match (match.ts).
    const candidates: CandidateResource[] = resources.map((resource): CandidateResource => {
      const s = stats.get(resource.id)
      return {
        resource,
        ratingsFromSimilarUsers: [],
        similarUsersCount: 0,
        averageRating: s?.averageRating || 0,
        basis: 'ratings',
        ratingCount: s?.ratingCount || 0,
      }
    })

    // Prefer nearby resources when we have coordinates, otherwise rank by
    // rating quality then volume.
    if (location && location.lat && location.lng) {
      // Nearby first; at the same distance, higher rated first.
      return withDistance(candidates, location)
        .sort((a, b) => nearestFirst(a, b) || b.averageRating - a.averageRating)
        .slice(0, limit)
    }

    return candidates
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating
        return b.ratingCount - a.ratingCount
      })
      .slice(0, limit)
  } catch (error) {
    console.error('Error getting fallback candidate resources:', error)
    return []
  }
}

// "Highly rated": an average of 4 or more, the same bar the similar-user path
// sets for the ratings it uses.
const HIGHLY_RATED = 4
// Ids per request. A long list of ids in the URL fails (lib/supabase/queries.ts).
const ID_BATCH = 200

/**
 * The average and number of ratings for each resource, from the ratings the recommender may learn from: without
 * test, QA, seed and synthetic accounts (STEP 93: on 30 October 2026, 518 of the 521 ratings were theirs). People
 * still see every rating on the pages that show them. Before STEP 93 the view isn't there, and this is ratingStats().
 */
async function recommenderRatingStats(
  supabase: SupabaseClient
): Promise<Map<string, { averageRating: number; ratingCount: number }>> {
  const sums = new Map<string, { total: number; n: number }>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('recommendation_ratings')
      .select('resource_id, overall_score')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return ratingStats()
    for (const r of data || []) {
      const t = sums.get(r.resource_id) || { total: 0, n: 0 }
      t.total += r.overall_score
      t.n += 1
      sums.set(r.resource_id, t)
    }
    if (!data || data.length < PAGE) break
  }
  return new Map(Array.from(sums, ([id, t]) => [id, { averageRating: t.total / t.n, ratingCount: t.n }]))
}

/**
 * Approved places rated 4 or more on average: best rated first, then the most
 * rated, then by id, so the same ratings always give the same list. This is
 * the cold start's pool when there are no coordinates.
 *
 * It used to be the first 200 approved rows in whatever order the table
 * returned them, so someone with no location was shown places in any city,
 * rated or not (Riipen Labs, Groups 22 and 24: "three matches at 40%, in the
 * wrong cities"). The home page now calls these "Highly rated places", which
 * the 4-star bar keeps true.
 */
async function bestRatedApprovedResources(supabase: SupabaseClient, limit: number): Promise<any[]> {
  const stats = await recommenderRatingStats(supabase)
  const ranked = Array.from(stats, ([id, s]) => ({ id, ...s }))
    .filter((s) => s.averageRating >= HIGHLY_RATED)
    .sort(
      (a, b) =>
        b.averageRating - a.averageRating || b.ratingCount - a.ratingCount || (a.id < b.id ? -1 : 1)
    )

  const out: any[] = []
  for (let i = 0; i < ranked.length && out.length < limit; i += ID_BATCH) {
    const ids = ranked.slice(i, i + ID_BATCH).map((s) => s.id)
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .in('id', ids)
      .eq('status', 'approved')
    if (error) throw error
    // Rows come back in any order; keep the ranking's.
    const rows = new Map((data || []).map((r: any) => [r.id, r]))
    for (const id of ids) {
      const row = rows.get(id)
      if (row && !isSelfListing(row)) out.push(row)
    }
  }
  return out.slice(0, limit)
}

/** Each candidate with its distance in km, when the place has a map point. */
function withDistance(candidates: CandidateResource[], location: Location): CandidateResource[] {
  return candidates.map((candidate) => {
    const loc = candidate.resource.location as Location | null
    const distance =
      loc?.lat && loc?.lng
        ? calculateDistance(location.lat!, location.lng!, loc.lat, loc.lng)
        : undefined
    return { ...candidate, distance }
  })
}

/** Nearest first, and places with no map point last. */
function nearestFirst(a: CandidateResource, b: CandidateResource): number {
  // Two places with no point: Infinity - Infinity is NaN, so 0.
  return (a.distance ?? Infinity) - (b.distance ?? Infinity) || 0
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}