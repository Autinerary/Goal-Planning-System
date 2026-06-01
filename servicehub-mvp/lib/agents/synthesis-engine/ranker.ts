import type { AgentOutputs, RankedResult, RankingFactor } from './types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

/**
 * Ranks and sorts results by weighing agent inputs
 * Combines scores from multiple agents into final ranking
 */
export function rankResults(
  recommendations: RecommendationAgentOutput | undefined,
  patterns: DiscoveredPattern[] | undefined,
  validations: ValidationAgentOutput[] | undefined
): { rankedResults: RankedResult[]; rankingFactors: RankingFactor[] } {
  if (!recommendations || !recommendations.resources || recommendations.resources.length === 0) {
    return { rankedResults: [], rankingFactors: [] }
  }

  const rankingFactors: RankingFactor[] = []
  const baseWeight = 0.5 // Recommendation Agent base weight
  const patternWeight = 0.3 // Pattern Agent boost weight
  const communityWeight = 0.2 // Community rating weight

  rankingFactors.push({ factor: 'Recommendation Score', weight: baseWeight, contribution: 0 })
  rankingFactors.push({ factor: 'Pattern Insights', weight: patternWeight, contribution: 0 })
  rankingFactors.push({ factor: 'Community Rating', weight: communityWeight, contribution: 0 })

  // Rank each resource
  const rankedResults: RankedResult[] = recommendations.resources.map((resource) => {
    // Base score from Recommendation Agent (0-100, normalize to 0-1)
    const baseScore = (resource.score || 0) / 100

    // Boost from Pattern Agent insights
    const patternBoost = calculatePatternBoost(resource, patterns)

    // Validation boost (positive if validated, negative if flagged)
    const validationBoost = calculateValidationBoost(resource, validations)

    // Community rating (normalize to 0-1)
    const communityRating =
      (resource.averageRatingFromSimilarUsers || 0) / 5 || 0

    // Calculate final score with weighted combination
    let finalScore = baseScore * baseWeight
    finalScore += patternBoost * patternWeight
    finalScore += communityRating * communityWeight

    // Apply validation boost (adjustment, not full weight)
    if (validationBoost !== 0) {
      finalScore += validationBoost * 0.1 // Smaller weight for validation
    }

    // Clamp to 0-1
    finalScore = Math.max(0, Math.min(1, finalScore))

    // Track ranking factors
    rankingFactors[0].contribution += baseScore * baseWeight
    rankingFactors[1].contribution += patternBoost * patternWeight
    rankingFactors[2].contribution += communityRating * communityWeight

    return {
      resource,
      baseScore,
      patternBoost,
      validationBoost,
      communityRating,
      finalScore,
      explanation: '', // Will be filled by explainer
      agentContributions: [],
    }
  })

  // Sort by final score (highest first)
  rankedResults.sort((a, b) => b.finalScore - a.finalScore)

  // Normalize ranking factor contributions
  if (rankedResults.length > 0) {
    rankingFactors.forEach((factor) => {
      factor.contribution = factor.contribution / rankedResults.length
    })
  }

  return { rankedResults, rankingFactors }
}

/**
 * Calculate pattern boost for a resource
 * Checks if resource matches discovered patterns
 */
function calculatePatternBoost(
  resource: any,
  patterns: DiscoveredPattern[] | undefined
): number {
  if (!patterns || patterns.length === 0 || !resource) {
    return 0
  }

  let boost = 0
  let matches = 0

  patterns.forEach((pattern) => {
    // Check if resource category matches pattern preferences
    const patternCategories = pattern.pattern.resource_categories || []
    if (patternCategories.includes(resource.category)) {
      boost += pattern.confidence / 100 // Add boost based on pattern confidence
      matches++
    }

    // Check if resource matches barrier-specific patterns
    const patternBarriers = pattern.pattern.barrier_combination || []
    if (patternBarriers.length > 0) {
      // Check if resource has high ratings for these barriers
      // This is simplified - in production, would check barrier_scores
      boost += 0.1 // Small boost for barrier match
    }
  })

  // Normalize boost (max 1.0)
  return Math.min(1.0, boost / Math.max(1, patterns.length / 2))
}

/**
 * Calculate validation boost for a resource
 * Positive if validated, negative if flagged
 */
function calculateValidationBoost(
  resource: any,
  validations: ValidationAgentOutput[] | undefined
): number {
  if (!validations || validations.length === 0 || !resource) {
    return 0
  }

  // Find validation result for this resource
  const validation = validations.find((v: any) => {
    // Check if validation is for this resource
    if (v.item && v.item.id === resource.id) {
      return true
    }
    // Check if validation decision affects this resource
    if (v.decision === 'approve') {
      return true
    }
    return false
  })

  if (!validation) {
    return 0
  }

  // Positive boost for approval, negative for rejection
  if (validation.decision === 'approve') {
    return validation.confidence / 100 // Boost based on confidence
  } else if (validation.decision === 'reject') {
    return -(validation.confidence / 100) // Penalty for rejection
  }

  return 0
}