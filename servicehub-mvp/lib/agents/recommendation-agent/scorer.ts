import type { CandidateResource, ScoredResource, Barrier } from './types'
import { calculateBarrierOverlap } from './similarity'

/**
 * Score resources based on multiple factors
 * Agent's decision-making algorithm
 */
export async function scoreResources(
  candidates: CandidateResource[],
  userBarriers: Barrier[],
  context?: string
): Promise<ScoredResource[]> {
  const scored: ScoredResource[] = candidates.map((candidate) => {
    // Factor 1: Barrier match score (40%)
    const barrierScore = calculateBarrierMatchScore(candidate, userBarriers)

    // Factor 2: Community rating from similar users (30%)
    const ratingScore = (candidate.averageRating / 5) * 0.3

    // Factor 3: Popularity among users with same barriers (30%)
    const popularityScore = Math.min(candidate.similarUsersCount / 20, 1) * 0.3

    // Context bonus (10% if context matches)
    let contextBonus = 0
    if (context) {
      contextBonus = calculateContextBonus(candidate, context) * 0.1
    }

    // Total score (0-1, scaled to 0-100)
    const totalScore = (barrierScore + ratingScore + popularityScore + contextBonus) * 100

    // Generate match reason
    const matchReason = generateMatchReason(candidate, userBarriers, barrierScore)

    return {
      ...candidate.resource,
      score: Math.round(totalScore),
      matchReason,
      similarUsersCount: candidate.similarUsersCount,
      averageRatingFromSimilarUsers: candidate.averageRating,
    }
  })

  // Sort by score (highest first)
  return scored.sort((a, b) => b.score - a.score)
}

/**
 * Calculate barrier match score (0-0.4)
 * Checks how well resource addresses user's barriers
 */
function calculateBarrierMatchScore(
  candidate: CandidateResource,
  userBarriers: Barrier[]
): number {
  if (userBarriers.length === 0) {
    return 0.2 // Neutral score if no barriers specified
  }

  // Check if resource has high ratings for specific barriers
  const barrierMatches = userBarriers.map((barrier) => {
    // Find ratings that mention this barrier type
    const relevantRatings = candidate.ratingsFromSimilarUsers.filter((rating) => {
      if (!rating.barrier_scores) return false
      const scores = rating.barrier_scores as any
      return scores[barrier.type] || scores[barrier.category]
    })

    if (relevantRatings.length === 0) {
      return 0
    }

    // Average rating for this specific barrier
    const avgBarrierRating =
      relevantRatings.reduce((sum, r) => {
        const scores = r.barrier_scores as any
        return sum + (scores[barrier.type] || scores[barrier.category] || r.overall_score)
      }, 0) / relevantRatings.length

    return avgBarrierRating / 5 // Normalize to 0-1
  })

  // Weight by severity if available
  const weightedMatches = barrierMatches.map((match, index) => {
    const severity = userBarriers[index].severity || 1
    return match * (severity / 5) // Weight by severity (1-5)
  })

  const averageMatch = weightedMatches.reduce((sum, m) => sum + m, 0) / weightedMatches.length
  return averageMatch * 0.4 // Scale to 0-0.4
}

/**
 * Calculate context bonus (0-1)
 * Checks if resource matches user's context (e.g., "looking for therapist")
 */
function calculateContextBonus(candidate: CandidateResource, context: string): number {
  const contextLower = context.toLowerCase()
  const resourceName = candidate.resource.name.toLowerCase()
  const resourceDesc = (candidate.resource.description || '').toLowerCase()
  const resourceCategory = candidate.resource.category.toLowerCase()

  let bonus = 0

  // Check category match
  if (
    (contextLower.includes('therapist') && resourceCategory === 'therapist') ||
    (contextLower.includes('doctor') && resourceCategory === 'doctor') ||
    (contextLower.includes('school') && resourceCategory === 'school')
  ) {
    bonus += 0.5
  }

  // Check name/description match
  if (resourceName.includes(contextLower) || resourceDesc.includes(contextLower)) {
    bonus += 0.3
  }

  // Check for keywords
  const keywords = ['new', 'first', 'beginner', 'autism', 'adhd', 'support']
  keywords.forEach((keyword) => {
    if (contextLower.includes(keyword) && (resourceName.includes(keyword) || resourceDesc.includes(keyword))) {
      bonus += 0.1
    }
  })

  return Math.min(bonus, 1) // Cap at 1
}

/**
 * Generate match reason explanation
 */
function generateMatchReason(
  candidate: CandidateResource,
  userBarriers: Barrier[],
  barrierScore: number
): string {
  const parts: string[] = []

  // Similar users count
  if (candidate.similarUsersCount > 0) {
    parts.push(
      `Recommended by ${candidate.similarUsersCount} ${candidate.similarUsersCount === 1 ? 'user' : 'users'} with similar barriers`
    )
  }

  // Barrier match
  if (userBarriers.length > 0 && barrierScore > 0.2) {
    const barrierTypes = userBarriers
      .slice(0, 3)
      .map((b) => b.type)
      .join(', ')
    parts.push(`High match for: ${barrierTypes}`)
  }

  // Rating
  if (candidate.averageRating >= 4.5) {
    parts.push('Highly rated by community')
  } else if (candidate.averageRating >= 4) {
    parts.push('Well-rated by community')
  }

  return parts.length > 0 ? parts.join(' • ') : 'Recommended based on community preferences'
}