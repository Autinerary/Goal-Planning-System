import { createClient } from '@/lib/supabase/server'
import type { BarrierCombination, PatternScope } from './types'

interface UserCluster {
  centroid: number[]
  members: Array<{ user_id: string; similarity: number }>
  size: number
}

interface ClusterPreference {
  clusterSize: number
  topCategories: { [category: string]: number }
  insight: string
}

/**
 * Find barrier combinations that frequently occur together
 * Agent discovers these autonomously without predefined targets
 */
export async function findBarrierCombinations(
  scope: PatternScope = 'global',
  minimumSupport: number = 5,
  category?: string,
  location?: string
): Promise<BarrierCombination[]> {
  const supabase = createClient()

  try {
    // Get all user barriers grouped by user
    let query = supabase
      .from('user_barriers')
      .select('user_id, barrier_category, barrier_type, severity')

    // Apply scope filters if needed
    if (scope === 'category' && category) {
      // Filter users who rated resources in this category
      // This is a simplified approach - in production, you'd join with ratings
      // For now, we'll filter barriers that might relate to the category
    }

    const { data: userBarriers, error } = await query

    if (error || !userBarriers || userBarriers.length === 0) {
      return []
    }

    // Group barriers by user
    const userBarrierMap = new Map<string, string[]>()
    const userSeverityMap = new Map<string, number[]>()

    userBarriers.forEach((barrier) => {
      const key = `${barrier.barrier_category}:${barrier.barrier_type}`
      
      if (!userBarrierMap.has(barrier.user_id)) {
        userBarrierMap.set(barrier.user_id, [])
        userSeverityMap.set(barrier.user_id, [])
      }

      userBarrierMap.get(barrier.user_id)!.push(key)
      if (barrier.severity) {
        userSeverityMap.get(barrier.user_id)!.push(barrier.severity)
      }
    })

    // Find combinations (users with 2+ barriers)
    const combinations = new Map<string, { frequency: number; avgSeverity: number; userIds: string[] }>()

    userBarrierMap.forEach((barriers, userId) => {
      if (barriers.length >= 2) {
        // Sort barriers for consistent combination keys
        const sortedBarriers = [...barriers].sort()
        const combinationKey = sortedBarriers.join('|')

        if (!combinations.has(combinationKey)) {
          const severities = userSeverityMap.get(userId) || []
          const avgSeverity =
            severities.length > 0 ? severities.reduce((a, b) => a + b, 0) / severities.length : 0

          combinations.set(combinationKey, {
            frequency: 1,
            avgSeverity,
            userIds: [userId],
          })
        } else {
          const existing = combinations.get(combinationKey)!
          existing.frequency++
          existing.userIds.push(userId)

          // Update average severity
          const severities = userSeverityMap.get(userId) || []
          if (severities.length > 0) {
            const avgSeverity =
              severities.reduce((a, b) => a + b, 0) / severities.length
            existing.avgSeverity =
              (existing.avgSeverity * (existing.frequency - 1) + avgSeverity) /
              existing.frequency
          }
        }
      }
    })

    // Filter by minimum support and convert to result format
    const results: BarrierCombination[] = []

    combinations.forEach((data, combinationKey) => {
      if (data.frequency >= minimumSupport) {
        const barrierArray = combinationKey.split('|')
        results.push({
          combination: barrierArray,
          frequency: data.frequency,
          avg_severity: data.avgSeverity,
          user_ids: data.userIds,
        })
      }
    })

    // Sort by frequency (most common first)
    return results.sort((a, b) => b.frequency - a.frequency)
  } catch (error) {
    console.error('Error finding barrier combinations:', error)
    return []
  }
}

/**
 * Calculate statistical confidence for a barrier combination
 */
export function calculateCombinationConfidence(
  frequency: number,
  totalUsers: number
): number {
  if (totalUsers === 0) return 0

  // Base confidence on frequency vs expected by chance
  const expectedFrequency = totalUsers * 0.05 // Assume 5% expected by chance
  const ratio = frequency / expectedFrequency

  // Confidence increases with frequency and ratio
  const confidence = Math.min((ratio * 30 + Math.min(frequency / 10, 40)), 100)

  return Math.round(confidence)
}

/**
 * Discover clusters of similar users using vector embeddings
 * Uses semantic similarity to find groups of users with similar barrier profiles
 */
export async function discoverUserClusters(): Promise<UserCluster[]> {
  const supabase = createClient()

  try {
    // Get all user embeddings
    const { data: embeddings, error } = await supabase
      .from('user_embeddings')
      .select('user_id, barrier_embedding')
      .not('barrier_embedding', 'is', null)

    if (error || !embeddings || embeddings.length === 0) {
      return []
    }

    // Simple clustering: find groups of similar users
    const clusters: UserCluster[] = []
    const processed = new Set<string>()

    for (const user of embeddings) {
      if (processed.has(user.user_id) || !user.barrier_embedding) {
        continue
      }

      // Find all users similar to this one using vector similarity
      const { data: clusterMembers, error: clusterError } = await supabase.rpc(
        'find_similar_users',
        {
          query_embedding: user.barrier_embedding,
          match_threshold: 0.8, // High similarity
          match_count: 100,
        }
      )

      if (clusterError || !clusterMembers || clusterMembers.length === 0) {
        continue
      }

      // Filter to meaningful cluster size (at least 5 members)
      const validMembers = clusterMembers.filter((m: any) => m.user_id !== user.user_id)

      if (validMembers.length >= 5) {
        clusters.push({
          centroid: user.barrier_embedding,
          members: validMembers,
          size: validMembers.length + 1, // +1 for the centroid user
        })

        // Mark all cluster members as processed
        validMembers.forEach((m: any) => processed.add(m.user_id))
        processed.add(user.user_id)
      }
    }

    return clusters
  } catch (error) {
    console.error('Error discovering user clusters:', error)
    return []
  }
}

/**
 * Discover what each cluster likes
 * Analyzes preferences of users in a cluster to find patterns
 */
export async function analyzeClusterPreferences(
  cluster: UserCluster
): Promise<ClusterPreference> {
  const supabase = createClient()

  try {
    const userIds = cluster.members.map((m) => m.user_id)

    // Get all highly-rated resources from cluster members
    const { data: preferences, error } = await supabase
      .from('ratings')
      .select('resource_id, overall_score, resources(category)')
      .in('user_id', userIds)
      .gte('overall_score', 4)

    if (error || !preferences || preferences.length === 0) {
      return {
        clusterSize: cluster.size,
        topCategories: {},
        insight: `Cluster of ${cluster.size} users - no clear preferences yet`,
      }
    }

    // Group by category to find patterns
    const categoryCounts: { [category: string]: number } = {}
    preferences.forEach((rating: any) => {
      const category = rating.resources?.category
      if (category) {
        categoryCounts[category] = (categoryCounts[category] || 0) + 1
      }
    })

    // Sort categories by count
    const sortedCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const topCategories: { [category: string]: number } = {}
    sortedCategories.forEach(([category, count]) => {
      topCategories[category] = count
    })

    // Generate insight
    const topCategory = sortedCategories[0]
    const insight = topCategory
      ? `Cluster of ${cluster.size} users with similar barriers prefers ${topCategory[0]} resources (${topCategory[1]} high ratings)`
      : `Cluster of ${cluster.size} users with similar barriers - preferences emerging`

    return {
      clusterSize: cluster.size,
      topCategories,
      insight,
    }
  } catch (error) {
    console.error('Error analyzing cluster preferences:', error)
    return {
      clusterSize: cluster.size,
      topCategories: {},
      insight: `Cluster of ${cluster.size} users - analysis error`,
    }
  }
}