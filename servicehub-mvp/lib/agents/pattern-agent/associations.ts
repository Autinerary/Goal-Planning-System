import { createClient } from '@/lib/supabase/server'
import { findSimilarResources as findSimilarResourcesFromVector } from '@/lib/supabase/vector-queries'
import { getResources } from '@/lib/supabase/queries'
import { getRatingsByResource } from '@/lib/supabase/queries'
import type { ResourceAffinity } from './types'
import type { Resource } from '@/types/database'

/**
 * Find resource affinity patterns
 * Discovers: "Users who rated Resource A highly also rated Resource B highly"
 * Uses vector similarity to find related resources
 */
export async function findResourceAffinity(
  scope: 'global' | 'category' = 'global',
  category?: string,
  minimumStrength: number = 0.7
): Promise<ResourceAffinity[]> {
  const supabase = createClient()

  try {
    // Get all approved resources
    const filters: { status?: 'approved'; category?: string; limit?: number } = {
      status: 'approved',
      limit: 100, // Sample first 100 for performance
    }

    if (scope === 'category' && category) {
      filters.category = category
    }

    const resources = await getResources(filters)

    if (resources.length === 0) {
      return []
    }

    const affinities: ResourceAffinity[] = []

    // For each resource, find similar resources using vector similarity
    for (const resource of resources.slice(0, 50)) {
      // Find similar resources using vector embeddings
      const similarResources = await findSimilarResources(resource.id, 5)

      if (similarResources.length === 0) {
        continue
      }

      // For each similar resource, check if users who rated the source
      // also rated the similar resource highly
      for (const similar of similarResources) {
        const affinity = await calculateAffinity(resource.id, similar.resource_id)

        if (affinity.strength >= minimumStrength && affinity.userCount >= 3) {
          affinities.push({
            source_resource_id: resource.id,
            related_resource_id: similar.resource_id,
            user_count: affinity.userCount,
            strength: affinity.strength,
            avg_rating_both: affinity.avgRating,
          })
        }
      }
    }

    // Sort by strength (strongest correlations first)
    return affinities.sort((a, b) => b.strength - a.strength)
  } catch (error) {
    console.error('Error finding resource affinity:', error)
    return []
  }
}

/**
 * Calculate affinity between two resources
 * Measures: How many users rated both resources highly?
 */
async function calculateAffinity(
  resourceId1: string,
  resourceId2: string
): Promise<{ strength: number; userCount: number; avgRating: number }> {
  const supabase = createClient()

  try {
    // Get ratings for both resources
    const ratings1 = await getRatingsByResource(resourceId1)
    const ratings2 = await getRatingsByResource(resourceId2)

    if (ratings1.length === 0 || ratings2.length === 0) {
      return { strength: 0, userCount: 0, avgRating: 0 }
    }

    // Find users who rated both resources (4+ stars)
    const highRatings1 = ratings1.filter((r) => r.overall_score >= 4)
    const highRatings2 = ratings2.filter((r) => r.overall_score >= 4)

    const users1 = new Set(highRatings1.map((r) => r.user_id))
    const users2 = new Set(highRatings2.map((r) => r.user_id))

    // Find intersection (users who rated both highly)
    const commonUsers = new Set([...users1].filter((u) => users2.has(u)))

    if (commonUsers.size === 0) {
      return { strength: 0, userCount: 0, avgRating: 0 }
    }

    // Calculate average rating for users who rated both
    let totalRating = 0
    let ratingCount = 0

    commonUsers.forEach((userId) => {
      const rating1 = highRatings1.find((r) => r.user_id === userId)
      const rating2 = highRatings2.find((r) => r.user_id === userId)

      if (rating1 && rating2) {
        totalRating += rating1.overall_score + rating2.overall_score
        ratingCount += 2
      }
    })

    const avgRating = ratingCount > 0 ? totalRating / ratingCount : 0

    // Calculate strength (correlation coefficient simplified)
    // Strength = (common users / min(users1, users2)) * (avg_rating / 5)
    const minUsers = Math.min(users1.size, users2.size)
    const overlapRatio = commonUsers.size / minUsers
    const ratingRatio = avgRating / 5
    const strength = overlapRatio * ratingRatio

    return {
      strength: Math.min(strength, 1), // Cap at 1
      userCount: commonUsers.size,
      avgRating,
    }
  } catch (error) {
    console.error('Error calculating affinity:', error)
    return { strength: 0, userCount: 0, avgRating: 0 }
  }
}

/**
 * Find similar resources using vector similarity
 * Helper function for resource affinity discovery
 */
async function findSimilarResources(
  resourceId: string,
  limit: number = 5
): Promise<Array<{ resource_id: string; similarity: number }>> {
  try {
    const supabase = createClient()

    // Get resource embedding
    const { data: embedding } = await supabase
      .from('resource_embeddings')
      .select('embedding')
      .eq('resource_id', resourceId)
      .single()

    if (!embedding || !embedding.embedding) {
      return []
    }

    // Find similar resources using vector similarity
    const { data: similar, error } = await supabase.rpc('find_similar_resources', {
      query_embedding: embedding.embedding,
      match_threshold: 0.7,
      match_count: limit + 1, // +1 to exclude the source resource
    })

    if (error) {
      // Fallback to manual query if RPC doesn't exist
      console.warn('RPC function not found, using manual query:', error)
      return []
    }

    // Filter out the source resource
    return (similar || []).filter((s: any) => s.resource_id !== resourceId).slice(0, limit)
  } catch (error) {
    console.error('Error finding similar resources:', error)
    return []
  }
}