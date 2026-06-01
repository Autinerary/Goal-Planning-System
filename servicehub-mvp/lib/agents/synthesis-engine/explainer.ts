import type { AgentOutputs, RankedResult, UserContext } from './types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

/**
 * Generates human-readable explanations from agent outputs
 * MVP: Rule-based explanations (will upgrade to LLM-powered natural language post-funding)
 */
export function generateExplanation(
  results: RankedResult[],
  agentOutputs: AgentOutputs,
  userContext: UserContext
): string {
  if (!results || results.length === 0) {
    return 'No results found'
  }

  const topResult = results[0]
  if (!topResult || !topResult.resource) {
    return 'Unable to generate explanation'
  }

  const resource = topResult.resource
  const parts: string[] = []

  // From Recommendation Agent
  const recommendations = agentOutputs.RecommendationAgent
  if (recommendations && resource.similarUsersCount) {
    parts.push(
      `Recommended based on ${resource.similarUsersCount} ${resource.similarUsersCount === 1 ? 'user' : 'users'} with similar barriers`
    )
  } else if (recommendations && recommendations.confidence) {
    parts.push(`Recommended with ${recommendations.confidence}% confidence`)
  }

  // From Pattern Agent
  const patterns = agentOutputs.PatternAgent
  if (patterns && Array.isArray(patterns) && patterns.length > 0) {
    const relevantPattern = patterns.find((p) => {
      const patternCategories = p.pattern.resource_categories || []
      return patternCategories.includes(resource.category)
    })

    if (relevantPattern) {
      parts.push(`Pattern discovered: ${relevantPattern.insight}`)
    }
  }

  // From community ratings
  const rating = resource.averageRatingFromSimilarUsers || resource.averageRating || 0
  const ratingCount = resource.similarUsersCount || resource.ratingCount || 0

  if (rating > 0 && ratingCount > 0) {
    parts.push(`Rated ${rating.toFixed(1)}/5 by ${ratingCount} ${ratingCount === 1 ? 'community member' : 'community members'}`)
  }

  // Barrier-specific scores
  if (userContext.barriers && userContext.barriers.length > 0 && resource.barrierScores) {
    const barrierMatches = userContext.barriers
      .map((barrier) => {
        const barrierKey = `${barrier.category}:${barrier.type}`
        const score = resource.barrierScores?.[barrierKey] || resource.barrierScores?.[barrier.type]

        if (score && score >= 4) {
          return `${barrier.type}: ${score.toFixed(1)}/5`
        }
        return null
      })
      .filter(Boolean)

    if (barrierMatches.length > 0) {
      parts.push(`High scores for your barriers: ${barrierMatches.join(', ')}`)
    }
  }

  // Pattern boost explanation
  if (topResult.patternBoost > 0.3) {
    parts.push(`Strong match for discovered community patterns`)
  }

  // Validation boost explanation
  if (topResult.validationBoost > 0) {
    parts.push(`Quality verified by validation agent`)
  }

  return parts.length > 0 ? parts.join(' • ') : 'Recommended based on community data'
}

/**
 * Generate explanation for a specific result
 */
export function generateResultExplanation(
  rankedResult: RankedResult,
  agentOutputs: AgentOutputs,
  userContext: UserContext
): string {
  const resource = rankedResult.resource
  const parts: string[] = []

  // Score breakdown
  if (rankedResult.finalScore > 0.8) {
    parts.push('High match score')
  } else if (rankedResult.finalScore > 0.6) {
    parts.push('Good match score')
  }

  // Pattern boost
  if (rankedResult.patternBoost > 0.3) {
    parts.push('Matches discovered patterns')
  }

  // Community rating
  if (rankedResult.communityRating > 0.8) {
    parts.push('Highly rated by community')
  } else if (rankedResult.communityRating > 0.6) {
    parts.push('Well-rated by community')
  }

  // Similar users
  if (resource.similarUsersCount && resource.similarUsersCount > 10) {
    parts.push(`Liked by ${resource.similarUsersCount} similar users`)
  }

  return parts.length > 0 ? parts.join(' • ') : 'Recommended resource'
}

/**
 * Generate agent contribution summaries
 */
export function generateAgentContributions(agentOutputs: AgentOutputs): Array<{
  agentName: string
  contribution: string
  confidence: number
  outputCount: number
}> {
  const contributions: Array<{
    agentName: string
    contribution: string
    confidence: number
    outputCount: number
  }> = []

  // Recommendation Agent contribution
  const recommendations = agentOutputs.RecommendationAgent
  if (recommendations) {
    contributions.push({
      agentName: 'Recommendation Agent',
      contribution: `Matched ${recommendations.resources?.length || 0} resources to your barriers using vector similarity`,
      confidence: recommendations.confidence || 0,
      outputCount: recommendations.resources?.length || 0,
    })
  }

  // Pattern Agent contribution
  const patterns = agentOutputs.PatternAgent
  if (patterns && Array.isArray(patterns)) {
    contributions.push({
      agentName: 'Pattern Recognition Agent',
      contribution: `Discovered ${patterns.length} relevant patterns from community data`,
      confidence: patterns.length > 0 ? patterns[0].confidence || 0 : 0,
      outputCount: patterns.length,
    })
  }

  // Validation Agent contribution
  const validation = agentOutputs.ValidationAgent
  if (validation) {
    contributions.push({
      agentName: 'Validation Agent',
      contribution: `Verified quality and authenticity (${validation.decision})`,
      confidence: validation.confidence || 0,
      outputCount: 1,
    })
  }

  // Search Service contribution
  const searchResults = agentOutputs.SearchService
  if (searchResults && Array.isArray(searchResults)) {
    contributions.push({
      agentName: 'Search Service',
      contribution: `Found ${searchResults.length} results using semantic and keyword search`,
      confidence: 85, // Search confidence
      outputCount: searchResults.length,
    })
  }

  return contributions
}