import { createClient } from '@/lib/supabase/server'
import { getRatingsByResource } from '@/lib/supabase/queries'
import type { SimilarUser, CandidateResource, Resource, Location } from './types'

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
    const { data: ratings, error } = await supabase
      .from('ratings')
      .select('resource_id, user_id, overall_score, barrier_scores')
      .in('user_id', similarUserIds)
      .gte('overall_score', 4)
      .limit(limit * 2) // Get more to filter later

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

    // Build candidate resources with metadata
    const candidates: CandidateResource[] = resources.map((resource) => {
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
      }
    })

    // Filter by location if provided
    if (location && location.lat && location.lng) {
      // Sort by distance if location provided
      const candidatesWithDistance = candidates
        .map((candidate) => {
          const resourceLocation = candidate.resource.location as Location | null
          if (resourceLocation?.lat && resourceLocation?.lng) {
            const distance = calculateDistance(
              location.lat!,
              location.lng!,
              resourceLocation.lat,
              resourceLocation.lng
            )
            return { ...candidate, distance }
          }
          return { ...candidate, distance: Infinity }
        })
        .sort((a, b) => (a as any).distance - (b as any).distance)

      return candidatesWithDistance.slice(0, limit) as CandidateResource[]
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
    const { data: resources, error } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .limit(200)

    if (error || !resources || resources.length === 0) {
      return []
    }

    // Aggregate community ratings for these resources.
    const resourceIds = resources.map((r) => r.id)
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score')
      .in('resource_id', resourceIds)

    const ratingAgg = new Map<string, { sum: number; count: number }>()
    ;(ratings || []).forEach((r) => {
      const agg = ratingAgg.get(r.resource_id) || { sum: 0, count: 0 }
      agg.sum += r.overall_score
      agg.count += 1
      ratingAgg.set(r.resource_id, agg)
    })

    const candidates: CandidateResource[] = resources.map((resource) => {
      const agg = ratingAgg.get(resource.id)
      const averageRating = agg && agg.count > 0 ? agg.sum / agg.count : 0
      return {
        resource,
        ratingsFromSimilarUsers: [],
        similarUsersCount: 0,
        averageRating,
      }
    })

    // Prefer nearby resources when we have coordinates, otherwise rank by
    // rating quality then volume.
    if (location && location.lat && location.lng) {
      return candidates
        .map((candidate) => {
          const loc = candidate.resource.location as Location | null
          const distance =
            loc?.lat && loc?.lng
              ? calculateDistance(location.lat!, location.lng!, loc.lat, loc.lng)
              : Infinity
          return { ...candidate, distance }
        })
        .sort((a, b) => {
          // Nearby first; within similar distance, higher rated first.
          const da = (a as any).distance as number
          const db = (b as any).distance as number
          if (da !== db && (da !== Infinity || db !== Infinity)) return da - db
          return b.averageRating - a.averageRating
        })
        .slice(0, limit) as CandidateResource[]
    }

    return candidates
      .sort((a, b) => {
        if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating
        return b.ratingsFromSimilarUsers.length - a.ratingsFromSimilarUsers.length
      })
      .slice(0, limit)
  } catch (error) {
    console.error('Error getting fallback candidate resources:', error)
    return []
  }
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