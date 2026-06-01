import { createClient } from '@/lib/supabase/server'
import { getRatingsByResource } from '@/lib/supabase/queries'
import type { TrustScoreResult, UserHistory } from './types'

/**
 * Calculate user trust score
 * Agent evaluates user's trustworthiness based on multiple signals
 */
export async function calculateUserTrust(userId: string): Promise<TrustScoreResult> {
  const supabase = createClient()

  try {
    // Get user data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      // New user - baseline trust
      return {
        trustScore: 50,
        factors: {
          accountAge: 0,
          contributions: 0,
          helpfulVotes: 0,
          violations: 0,
          consistency: 50,
        },
      }
    }

    // Calculate account age in days
    const accountAge = profile.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Get user's ratings
    const { data: ratings, error: ratingsError } = await supabase
      .from('ratings')
      .select('id, overall_score, helpful_count, created_at')
      .eq('user_id', userId)

    const ratingsCount = ratings?.length || 0

    // Get resources submitted
    const { data: resources, error: resourcesError } = await supabase
      .from('resources')
      .select('id')
      .eq('submitted_by', userId)

    const resourcesSubmitted = resources?.length || 0

    // Calculate helpful votes received
    const helpfulVotes = ratings?.reduce((sum, r) => sum + (r.helpful_count || 0), 0) || 0

    // Get violations (from moderation queue rejections)
    const { data: violations, error: violationsError } = await supabase
      .from('moderation_queue')
      .select('id')
      .eq('submitted_by', userId)
      .eq('status', 'rejected')

    const violationsCount = violations?.length || 0

    // Calculate consistency score (how well user's ratings align with community)
    const consistencyScore = await calculateConsistency(userId, ratings || [])

    // Calculate trust score
    let trustScore = 50 // Baseline

    // Account age bonus (older = more trustworthy, max +20)
    const accountAgeBonus = Math.min(20, accountAge / 2)
    trustScore += accountAgeBonus

    // Previous contributions (ratings + resources, max +20)
    const contributions = ratingsCount + resourcesSubmitted
    trustScore += Math.min(20, contributions * 2)

    // Helpful votes received (max +10)
    trustScore += Math.min(10, helpfulVotes)

    // Violations penalty (max -30)
    trustScore -= Math.min(30, violationsCount * 15)

    // Consistency bonus (max +10)
    trustScore += consistencyScore * 10

    // Clamp to 0-100
    trustScore = Math.max(0, Math.min(100, trustScore))

    return {
      trustScore: Math.round(trustScore),
      factors: {
        accountAge: Math.round(accountAgeBonus),
        contributions: Math.min(20, contributions * 2),
        helpfulVotes: Math.min(10, helpfulVotes),
        violations: Math.min(30, violationsCount * 15),
        consistency: Math.round(consistencyScore * 100),
      },
    }
  } catch (error) {
    console.error('Error calculating user trust:', error)
    // Return baseline on error
    return {
      trustScore: 50,
      factors: {
        accountAge: 0,
        contributions: 0,
        helpfulVotes: 0,
        violations: 0,
        consistency: 50,
      },
    }
  }
}

/**
 * Calculate consistency score
 * Measures how well user's ratings align with community average
 */
async function calculateConsistency(userId: string, userRatings: any[]): Promise<number> {
  if (userRatings.length === 0) {
    return 0.5 // Neutral consistency for new users
  }

  const supabase = createClient()
  let totalDifference = 0
  let count = 0

  try {
    // For each rating, compare with resource's average
    for (const rating of userRatings.slice(0, 10)) {
      // Get resource average rating
      const { data: resource } = await supabase
        .from('resources')
        .select('id')
        .eq('id', rating.resource_id)
        .single()

      if (!resource) continue

      const communityRatings = await getRatingsByResource(resource.id)
      if (communityRatings.length === 0) continue

      const communityAverage =
        communityRatings.reduce((sum, r) => sum + r.overall_score, 0) / communityRatings.length

      const userRating = rating.overall_score
      const difference = Math.abs(userRating - communityAverage)

      totalDifference += difference
      count++
    }

    if (count === 0) {
      return 0.5
    }

    const avgDifference = totalDifference / count

    // Convert difference to consistency score (0-1)
    // Difference of 0 = 1.0, difference of 2+ = 0.0
    const consistency = Math.max(0, 1 - avgDifference / 2)

    return consistency
  } catch (error) {
    console.error('Error calculating consistency:', error)
    return 0.5
  }
}

/**
 * Get user history for validation context
 */
export async function getUserHistory(userId: string): Promise<UserHistory> {
  const supabase = createClient()

  try {
    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('created_at')
      .eq('id', userId)
      .single()

    const accountAgeDays = profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // Get ratings count
    const { count: ratingsCount } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get resources submitted
    const { count: resourcesSubmitted } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .eq('submitted_by', userId)

    // Get helpful votes
    const { data: ratings } = await supabase
      .from('ratings')
      .select('helpful_count')
      .eq('user_id', userId)

    const helpfulVotes = ratings?.reduce((sum, r) => sum + (r.helpful_count || 0), 0) || 0

    // Get violations
    const { count: violations } = await supabase
      .from('moderation_queue')
      .select('*', { count: 'exact', head: true })
      .eq('submitted_by', userId)
      .eq('status', 'rejected')

    // Get recent activity
    const recentActivity = await getRecentActivity(userId)

    return {
      accountAgeDays,
      ratingsCount: ratingsCount || 0,
      resourcesSubmitted: resourcesSubmitted || 0,
      helpfulVotes,
      violations: violations || 0,
      recentActivity,
    }
  } catch (error) {
    console.error('Error getting user history:', error)
    return {
      accountAgeDays: 0,
      ratingsCount: 0,
      resourcesSubmitted: 0,
      helpfulVotes: 0,
      violations: 0,
    }
  }
}

/**
 * Get recent user activity
 */
async function getRecentActivity(userId: string): Promise<any> {
  const supabase = createClient()
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  try {
    // Get ratings from last 24 hours
    const { data: recentRatings } = await supabase
      .from('ratings')
      .select('overall_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', last24h.toISOString())

    const last24hCount = recentRatings?.length || 0

    // Get ratings from last 7 days
    const { data: weekRatings } = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', last7d.toISOString())

    const last7dCount = weekRatings?.length || 0

    // Get all recent ratings for pattern analysis
    const { data: allRecentRatings } = await supabase
      .from('ratings')
      .select('overall_score, created_at')
      .eq('user_id', userId)
      .gte('created_at', last7d.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    const ratings = (allRecentRatings || []).map((r) => ({
      rating: r.overall_score,
      timestamp: r.created_at,
    }))

    const timestamps = ratings.map((r) => r.timestamp)

    // Get recent resources submitted
    const { data: recentResources } = await supabase
      .from('resources')
      .select('id')
      .eq('submitted_by', userId)
      .gte('created_at', last7d.toISOString())

    const resources = (recentResources || []).map((r) => r.id)

    return {
      last24h: last24hCount,
      last7d: last7dCount,
      ratings,
      timestamps,
      resources,
    }
  } catch (error) {
    console.error('Error getting recent activity:', error)
    return {
      last24h: 0,
      last7d: 0,
      ratings: [],
      timestamps: [],
      resources: [],
    }
  }
}