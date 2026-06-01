import { createClient } from '@/lib/supabase/server'
import { findSimilarUsers } from '@/lib/supabase/vector-queries'
import { getResources } from '@/lib/supabase/queries'

interface Recommendation {
  resource_id: string
  score: number
  averageRating: number
  ratingCount: number
  similarUsers: number
}

/**
 * Simple recommendation algorithm (no AI cost):
 * 1. Find users with similar barriers
 * 2. Get their top-rated resources
 * 3. Rank by average rating + number of similar users
 */
export async function getRecommendedResources(userId: string, limit: number = 8) {
  const supabase = createClient()

  try {
    // Method 1: Use vector similarity to find similar users
    const similarUsers = await findSimilarUsers(userId, 20, 0.6)
    
    if (similarUsers.length === 0) {
      // Fallback: Use direct barrier matching if no similar users found
      return getResourcesByDirectBarrierMatch(userId, limit)
    }

    // Get resources from similar users
    const resourceScores: Map<string, { ratings: number[]; users: Set<string> }> = new Map()

    for (const similarUser of similarUsers) {
      // Get ratings from this similar user
      const { data: ratings } = await supabase
        .from('ratings')
        .select('resource_id, overall_score')
        .eq('user_id', similarUser.user_id)
        .gte('overall_score', 4) // Only highly rated resources

      if (ratings) {
        for (const rating of ratings) {
          if (!resourceScores.has(rating.resource_id)) {
            resourceScores.set(rating.resource_id, {
              ratings: [],
              users: new Set(),
            })
          }
          const scores = resourceScores.get(rating.resource_id)!
          scores.ratings.push(rating.overall_score)
          scores.users.add(similarUser.user_id)
        }
      }
    }

    // Calculate scores: average rating + (similar users * 0.1)
    const recommendations: Recommendation[] = []
    
    for (const [resourceId, scores] of resourceScores.entries()) {
      const averageRating = scores.ratings.reduce((a, b) => a + b, 0) / scores.ratings.length
      const similarUsersCount = scores.users.size
      const score = averageRating + similarUsersCount * 0.1

      recommendations.push({
        resource_id: resourceId,
        score,
        averageRating,
        ratingCount: scores.ratings.length,
        similarUsers: similarUsersCount,
      })
    }

    // Sort by score and get top resources
    recommendations.sort((a, b) => b.score - a.score)
    const topResourceIds = recommendations.slice(0, limit).map((r) => r.resource_id)

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', topResourceIds)
      .eq('status', 'approved')

    if (!resources) return []

    // Combine with scores
    return resources.map((resource) => {
      const rec = recommendations.find((r) => r.resource_id === resource.id)
      return {
        ...resource,
        recommendationScore: rec?.score || 0,
        averageRating: rec?.averageRating || 0,
        ratingCount: rec?.ratingCount || 0,
        similarUsers: rec?.similarUsers || 0,
      }
    })
  } catch (error) {
    console.error('Error getting recommended resources:', error)
    return []
  }
}

/**
 * Fallback: Get resources by direct barrier matching
 */
async function getResourcesByDirectBarrierMatch(userId: string, limit: number) {
  const supabase = createClient()

  try {
    // Get user's barriers
    const { data: userBarriers } = await supabase
      .from('user_barriers')
      .select('barrier_type')
      .eq('user_id', userId)

    if (!userBarriers || userBarriers.length === 0) {
      return []
    }

    // Get resources with ratings from users with similar barriers
    const barrierTypes = userBarriers.map((b) => b.barrier_type)

    // Get users with similar barriers
    const { data: similarUsers } = await supabase
      .from('user_barriers')
      .select('user_id')
      .in('barrier_type', barrierTypes)
      .neq('user_id', userId)
      .limit(50)

    if (!similarUsers || similarUsers.length === 0) {
      return []
    }

    const similarUserIds = [...new Set(similarUsers.map((u) => u.user_id))]

    // Get top-rated resources from similar users
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score')
      .in('user_id', similarUserIds)
      .gte('overall_score', 4)
      .limit(100)

    if (!ratings || ratings.length === 0) {
      return []
    }

    // Aggregate ratings by resource
    const resourceRatings: Map<string, number[]> = new Map()
    for (const rating of ratings) {
      if (!resourceRatings.has(rating.resource_id)) {
        resourceRatings.set(rating.resource_id, [])
      }
      resourceRatings.get(rating.resource_id)!.push(rating.overall_score)
    }

    // Sort by average rating
    const sortedResources = Array.from(resourceRatings.entries())
      .map(([resourceId, scores]) => ({
        resourceId,
        averageRating: scores.reduce((a, b) => a + b, 0) / scores.length,
        ratingCount: scores.length,
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit)

    const resourceIds = sortedResources.map((r) => r.resourceId)

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')

    if (!resources) return []

    // Combine with ratings
    return resources.map((resource) => {
      const rec = sortedResources.find((r) => r.resourceId === resource.id)
      return {
        ...resource,
        averageRating: rec?.averageRating || 0,
        ratingCount: rec?.ratingCount || 0,
      }
    })
  } catch (error) {
    console.error('Error getting resources by barrier match:', error)
    return []
  }
}

/**
 * Get most useful resources (highest helpful_count from ratings)
 */
export async function getMostUsefulResources(limit: number = 12) {
  const supabase = createClient()

  try {
    // Get all ratings with helpful_count
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, helpful_count')
      .gt('helpful_count', 0)
      .limit(1000)

    if (!ratings || ratings.length === 0) {
      // Fallback to recently added if no helpful ratings
      return getResources({ status: 'approved', limit })
    }

    // Aggregate helpful_count by resource
    const resourceHelpful: Map<string, number> = new Map()
    for (const rating of ratings) {
      const current = resourceHelpful.get(rating.resource_id) || 0
      resourceHelpful.set(rating.resource_id, current + rating.helpful_count)
    }

    // Sort by total helpful_count
    const sortedResources = Array.from(resourceHelpful.entries())
      .map(([resourceId, totalHelpful]) => ({
        resourceId,
        totalHelpful,
      }))
      .sort((a, b) => b.totalHelpful - a.totalHelpful)
      .slice(0, limit)

    const resourceIds = sortedResources.map((r) => r.resourceId)

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')

    if (!resources) return []

    // Combine with helpful counts and sort by original order
    const resourceMap = new Map(resources.map((r) => [r.id, r]))
    const helpfulMap = new Map(sortedResources.map((r) => [r.resourceId, r.totalHelpful]))
    
    return sortedResources
      .map((rec) => {
        const resource = resourceMap.get(rec.resourceId)
        return resource
          ? {
              ...resource,
              helpfulCount: helpfulMap.get(rec.resourceId) || 0,
            }
          : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  } catch (error) {
    console.error('Error getting most useful resources:', error)
    return []
  }
}

/**
 * Get resources to avoid (low-rated with reasons from comments)
 */
export async function getAvoidancesResources(limit: number = 12) {
  const supabase = createClient()

  try {
    // Get all ratings with low scores (1-2 stars)
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score, comment')
      .lte('overall_score', 2)
      .not('comment', 'is', null)
      .limit(1000)

    if (!ratings || ratings.length === 0) {
      return []
    }

    // Group by resource and get average rating
    const resourceRatings: Map<string, { scores: number[]; comments: string[] }> = new Map()
    for (const rating of ratings) {
      if (!resourceRatings.has(rating.resource_id)) {
        resourceRatings.set(rating.resource_id, { scores: [], comments: [] })
      }
      const resource = resourceRatings.get(rating.resource_id)!
      resource.scores.push(rating.overall_score)
      if (rating.comment) {
        resource.comments.push(rating.comment)
      }
    }

    // Sort by average rating (lowest first) and minimum 2 ratings
    const sortedResources = Array.from(resourceRatings.entries())
      .filter(([_, data]) => data.scores.length >= 2) // At least 2 low ratings
      .map(([resourceId, data]) => ({
        resourceId,
        averageRating: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        ratingCount: data.scores.length,
        reasons: data.comments.slice(0, 3), // Top 3 reasons
      }))
      .sort((a, b) => a.averageRating - b.averageRating) // Lowest first
      .slice(0, limit)

    const resourceIds = sortedResources.map((r) => r.resourceId)

    if (resourceIds.length === 0) {
      return []
    }

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')

    if (!resources) return []

    // Combine with ratings and reasons
    const resourceMap = new Map(resources.map((r) => [r.id, r]))
    const reasonsMap = new Map(sortedResources.map((r) => [r.resourceId, r.reasons]))
    const ratingMap = new Map(
      sortedResources.map((r) => [
        r.resourceId,
        { averageRating: r.averageRating, ratingCount: r.ratingCount },
      ])
    )

    return sortedResources
      .map((rec) => {
        const resource = resourceMap.get(rec.resourceId)
        return resource
          ? {
              ...resource,
              averageRating: rec.averageRating,
              ratingCount: rec.ratingCount,
              avoidReasons: reasonsMap.get(rec.resourceId) || [],
            }
          : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  } catch (error) {
    console.error('Error getting avoidances resources:', error)
    return []
  }
}

/**
 * Get highest rated resources by category
 */
export async function getHighestRatedByCategory(category: string, limit: number = 8) {
  const supabase = createClient()

  try {
    // Get all ratings for resources in this category
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score, resources!inner(category)')
      .eq('resources.category', category)
      .limit(1000)

    if (!ratings || ratings.length === 0) {
      return []
    }

    // Aggregate ratings by resource
    const resourceRatings: Map<string, number[]> = new Map()
    for (const rating of ratings) {
      if (!resourceRatings.has(rating.resource_id)) {
        resourceRatings.set(rating.resource_id, [])
      }
      resourceRatings.get(rating.resource_id)!.push(rating.overall_score)
    }

    // Sort by average rating (minimum 3 ratings)
    const sortedResources = Array.from(resourceRatings.entries())
      .filter(([_, scores]) => scores.length >= 3)
      .map(([resourceId, scores]) => ({
        resourceId,
        averageRating: scores.reduce((a, b) => a + b, 0) / scores.length,
        ratingCount: scores.length,
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit)

    const resourceIds = sortedResources.map((r) => r.resourceId)

    if (resourceIds.length === 0) {
      return []
    }

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')
      .eq('category', category)

    if (!resources) return []

    // Combine with ratings
    const resourceMap = new Map(resources.map((r) => [r.id, r]))
    return sortedResources
      .map((rec) => {
        const resource = resourceMap.get(rec.resourceId)
        return resource
          ? {
              ...resource,
              averageRating: rec.averageRating,
              ratingCount: rec.ratingCount,
            }
          : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  } catch (error) {
    console.error('Error getting highest rated by category:', error)
    return []
  }
}

/**
 * Get resources in user's location, organized by category
 */
export async function getLocationResources(
  userLocation: { city?: string; province?: string },
  limitPerCategory: number = 6
) {
  const supabase = createClient()

  try {
    if (!userLocation.city && !userLocation.province) {
      return []
    }

    // Get resources matching user's location
    // Note: JSONB queries in Supabase need exact matches or text search
    // We'll fetch all approved resources and filter client-side for now
    const { data: allResources } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .limit(200)

    if (!allResources || allResources.length === 0) {
      return []
    }

    // Filter by location (client-side for JSONB matching)
    const resources = allResources.filter((resource) => {
      if (!resource.location) return false
      const loc = resource.location as { city?: string; province?: string }
      if (userLocation.city && loc.city?.toLowerCase() === userLocation.city.toLowerCase()) {
        return true
      }
      if (userLocation.province && loc.province?.toLowerCase() === userLocation.province.toLowerCase()) {
        return true
      }
      return false
    })

    if (!resources || resources.length === 0) {
      return []
    }

    // Group by category
    const byCategory: Map<string, typeof resources> = new Map()
    for (const resource of resources) {
      const category = resource.category
      if (!byCategory.has(category)) {
        byCategory.set(category, [])
      }
      byCategory.get(category)!.push(resource)
    }

    // Get ratings for all resources
    const resourceIds = resources.map((r) => r.id)
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score')
      .in('resource_id', resourceIds)

    const ratingMap = new Map<string, number[]>()
    ratings?.forEach((rating) => {
      if (!ratingMap.has(rating.resource_id)) {
        ratingMap.set(rating.resource_id, [])
      }
      ratingMap.get(rating.resource_id)!.push(rating.overall_score)
    })

    // Calculate averages and sort
    const result: { category: string; resources: any[] }[] = []
    for (const [category, categoryResources] of byCategory.entries()) {
      const withRatings = categoryResources
        .map((resource) => {
          const scores = ratingMap.get(resource.id) || []
          return {
            ...resource,
            averageRating: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
            ratingCount: scores.length,
          }
        })
        .sort((a, b) => b.averageRating - a.averageRating)
        .slice(0, limitPerCategory)

      if (withRatings.length > 0) {
        result.push({ category, resources: withRatings })
      }
    }

    return result
  } catch (error) {
    console.error('Error getting location resources:', error)
    return []
  }
}

/**
 * Get cheapest resources (lowest price, excluding free)
 */
export async function getCheapestResources(limit: number = 12) {
  const supabase = createClient()

  try {
    // Get all resources with prices (exclude NULL/free)
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .not('price', 'is', null)
      .gt('price', 0)
      .order('price', { ascending: true })
      .limit(limit * 2) // Get more to filter by category

    if (!resources || resources.length === 0) {
      return []
    }

    // Get ratings for resources
    const resourceIds = resources.map((r) => r.id)
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score')
      .in('resource_id', resourceIds)

    const ratingMap = new Map<string, number[]>()
    ratings?.forEach((rating) => {
      if (!ratingMap.has(rating.resource_id)) {
        ratingMap.set(rating.resource_id, [])
      }
      ratingMap.get(rating.resource_id)!.push(rating.overall_score)
    })

    // Add ratings to resources and limit
    return resources.slice(0, limit).map((resource) => {
      const scores = ratingMap.get(resource.id) || []
      return {
        ...resource,
        averageRating: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
        ratingCount: scores.length,
      }
    })
  } catch (error) {
    console.error('Error getting cheapest resources:', error)
    return []
  }
}

/**
 * Get popular resources (highest rated)
 */
export async function getPopularResources(limit: number = 12) {
  const supabase = createClient()

  try {
    // Get all ratings
    const { data: ratings } = await supabase
      .from('ratings')
      .select('resource_id, overall_score')
      .limit(1000)

    if (!ratings || ratings.length === 0) {
      // Fallback to recently added if no ratings
      return getResources({ status: 'approved', limit })
    }

    // Aggregate ratings by resource
    const resourceRatings: Map<string, number[]> = new Map()
    for (const rating of ratings) {
      if (!resourceRatings.has(rating.resource_id)) {
        resourceRatings.set(rating.resource_id, [])
      }
      resourceRatings.get(rating.resource_id)!.push(rating.overall_score)
    }

    // Sort by average rating (minimum 5 ratings)
    const sortedResources = Array.from(resourceRatings.entries())
      .filter(([_, scores]) => scores.length >= 5)
      .map(([resourceId, scores]) => ({
        resourceId,
        averageRating: scores.reduce((a, b) => a + b, 0) / scores.length,
        ratingCount: scores.length,
      }))
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit)

    const resourceIds = sortedResources.map((r) => r.resourceId)

    // Get full resource data
    const { data: resources } = await supabase
      .from('resources')
      .select('*')
      .in('id', resourceIds)
      .eq('status', 'approved')

    if (!resources) return []

    // Combine with ratings and sort by original order
    const resourceMap = new Map(resources.map((r) => [r.id, r]))
    return sortedResources
      .map((rec) => {
        const resource = resourceMap.get(rec.resourceId)
        return resource
          ? {
              ...resource,
              averageRating: rec.averageRating,
              ratingCount: rec.ratingCount,
            }
          : null
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  } catch (error) {
    console.error('Error getting popular resources:', error)
    return getResources({ status: 'approved', limit })
  }
}
