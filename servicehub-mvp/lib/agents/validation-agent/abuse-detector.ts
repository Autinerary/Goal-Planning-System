import type { UserHistory } from './types'

export interface AbuseCheckResult {
  passed: boolean
  score: number // 0-100
  issues: string[]
}

/**
 * Detect abuse patterns in user behavior
 * Agent analyzes behavioral patterns for suspicious activity
 */
export async function detectAbuse(
  userId: string,
  userHistory: UserHistory
): Promise<AbuseCheckResult> {
  const issues: string[] = []
  let abuseScore = 0

  if (!userHistory.recentActivity) {
    // No recent activity - not suspicious
    return {
      passed: true,
      score: 100,
      issues: [],
    }
  }

  const activity = userHistory.recentActivity

  // Check 1: Too many submissions in 24 hours
  if (activity.last24h > 20) {
    issues.push(`Too many submissions in 24 hours (${activity.last24h})`)
    abuseScore += 30
  }

  // Check 2: All same rating (suspicious uniformity)
  if (hasUniformRatings(activity.ratings)) {
    issues.push('All ratings are identical (suspicious uniformity)')
    abuseScore += 25
  }

  // Check 3: Rapid-fire submissions (spam pattern)
  if (hasRapidSubmissions(activity.timestamps)) {
    issues.push('Rapid-fire submissions detected')
    abuseScore += 20
  }

  // Check 4: Targeting specific resource (manipulation)
  if (isTargetingResource(activity)) {
    issues.push('Potential targeted manipulation detected')
    abuseScore += 15
  }

  // Check 5: Very new account with high activity
  if (userHistory.accountAgeDays < 7 && activity.last24h > 10) {
    issues.push('New account with unusually high activity')
    abuseScore += 20
  }

  // Check 6: Only negative or only positive ratings
  if (hasExtremeRatings(activity.ratings)) {
    issues.push('Ratings are all extreme (all negative or all positive)')
    abuseScore += 15
  }

  const score = Math.max(0, 100 - abuseScore)

  return {
    passed: abuseScore < 40 && issues.length < 2,
    score,
    issues,
  }
}

/**
 * Check if all ratings are identical
 */
function hasUniformRatings(ratings: Array<{ rating: number; timestamp: string }>): boolean {
  if (ratings.length < 3) {
    return false
  }

  const firstRating = ratings[0].rating
  return ratings.every((r) => r.rating === firstRating)
}

/**
 * Check for rapid-fire submissions (submissions within seconds)
 */
function hasRapidSubmissions(timestamps: string[]): boolean {
  if (timestamps.length < 3) {
    return false
  }

  // Check if 3+ submissions within 60 seconds
  const sorted = [...timestamps].sort()
  for (let i = 0; i < sorted.length - 2; i++) {
    const time1 = new Date(sorted[i]).getTime()
    const time2 = new Date(sorted[i + 2]).getTime()
    const diffSeconds = (time2 - time1) / 1000

    if (diffSeconds < 60) {
      return true
    }
  }

  return false
}

/**
 * Check if user is targeting a specific resource
 */
function isTargetingResource(activity: any): boolean {
  // If user has many ratings but they're all for different resources,
  // or if they're all for the same resource, it might be manipulation
  // This is a simplified check - in production, use more sophisticated analysis

  if (activity.ratings.length < 5) {
    return false
  }

  // Check if 80%+ of ratings are for resources submitted in last 7 days
  // (might indicate coordinated manipulation)
  if (activity.resources.length > 0) {
    const recentResourceRatio = activity.resources.length / activity.ratings.length
    if (recentResourceRatio > 0.8) {
      return true
    }
  }

  return false
}

/**
 * Check if ratings are all extreme (all 1-2 or all 4-5)
 */
function hasExtremeRatings(ratings: Array<{ rating: number; timestamp: string }>): boolean {
  if (ratings.length < 5) {
    return false
  }

  const allLow = ratings.every((r) => r.rating <= 2)
  const allHigh = ratings.every((r) => r.rating >= 4)

  return allLow || allHigh
}