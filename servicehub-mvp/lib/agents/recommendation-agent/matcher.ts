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