import { getUserBarriers } from '@/lib/supabase/queries'
import { findSimilarUsersByBarriers } from './similarity'
import { getCandidateResources } from './matcher'
import { scoreResources } from './scorer'
import { completeJSON, isLLMEnabled } from '@/lib/llm'
import type {
  RecommendationAgentInput,
  RecommendationAgentOutput,
  ScoredResource,
  Barrier,
} from './types'

/**
 * Agent 1: Recommendation Agent
 * MVP: Rule-based matching (will upgrade to LLM-powered agent post-funding)
 * Job: Match people with resources based on their barriers
 *
 * Architecture: Modular design allows easy upgrade to true AI agent
 * - Current: Rule-based algorithms using vector similarity
 * - Future: LLM-powered decision-making with same interface
 *
 * Migration Path: Replace scoring functions with Claude API calls while keeping same interface
 */
export class RecommendationAgent {
  /**
   * Main agent decision-making function
   * Generates personalized resource recommendations
   */
  async generateRecommendations(
    input: RecommendationAgentInput
  ): Promise<RecommendationAgentOutput> {
    try {
      // Step 1: Find similar users (collaborative filtering)
      const similarUsers = await this.findSimilarUsers(input.userId, input.barriers)

      // Step 2: Get resources rated highly by similar users
      const candidateResources = await this.getCandidateResources(
        similarUsers,
        input.location
      )

      // Step 3: Score each resource (agent's decision-making)
      const scoredResources = await this.scoreResources(
        candidateResources,
        input.barriers,
        input.context
      )

      // Step 4: Generate explanations (why agent chose these)
      const explanations = await this.generateExplanations(scoredResources, input.barriers)

      // Step 5: Calculate confidence score
      const confidence = this.calculateConfidence(scoredResources, similarUsers.length)

      return {
        resources: scoredResources.slice(0, 20), // Top 20 recommendations
        matchScores: scoredResources.map((r) => r.score),
        explanations,
        confidence,
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      // Return empty result on error
      return {
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
      }
    }
  }

  /**
   * Helper function: Find similar users
   * Uses vector database for similarity matching
   */
  private async findSimilarUsers(userId: string, barriers: Barrier[]) {
    try {
      // Using vector database for similarity!
      const similarUsers = await findSimilarUsersByBarriers(userId, barriers, 50, 0.7)

      // Vector DB returns users with similar barrier embeddings
      // Much more accurate than manual comparison
      return similarUsers
    } catch (error) {
      console.error('Error finding similar users:', error)
      return []
    }
  }

  /**
   * Helper function: Get candidate resources
   * Filters resources rated highly by similar users
   */
  private async getCandidateResources(similarUsers: any[], location?: any) {
    if (similarUsers.length === 0) {
      return []
    }

    return getCandidateResources(similarUsers, location, 100)
  }

  /**
   * Helper function: Score resources
   * Agent's scoring algorithm
   */
  private async scoreResources(
    candidateResources: any[],
    barriers: Barrier[],
    context?: string
  ) {
    return scoreResources(candidateResources, barriers, context)
  }

  /**
   * Generate explanations for recommendations
   * Agent explains its decisions (LLM-backed with rule-based fallback).
   */
  private async generateExplanations(
    resources: ScoredResource[],
    barriers: Barrier[]
  ): Promise<string[]> {
    const ruleBased = (resource: ScoredResource): string => {
      const parts: string[] = []
      if (resource.similarUsersCount > 0) {
        const barrierTypes = barriers
          .slice(0, 2)
          .map((b) => b.type)
          .join(' + ')
        parts.push(
          `Recommended by ${resource.similarUsersCount} ${resource.similarUsersCount === 1 ? 'user' : 'users'} with ${barrierTypes}`
        )
      }
      if (resource.score >= 80) parts.push(`${resource.score}% match for your barriers`)
      else if (resource.score >= 60) parts.push(`${resource.score}% match`)
      if (resource.averageRatingFromSimilarUsers >= 4.5) parts.push('Highly rated (4.5+ stars)')
      return parts.length > 0 ? parts.join(' • ') : resource.matchReason
    }

    if (!isLLMEnabled() || resources.length === 0) {
      return resources.map(ruleBased)
    }

    const top = resources.slice(0, 10)
    const payload = top.map((r, i) => ({
      i,
      name: (r as any).name || (r as any).resource_name || `Resource ${i}`,
      score: r.score,
      similarUsers: r.similarUsersCount,
      avgRating: r.averageRatingFromSimilarUsers,
    }))

    const data = await completeJSON<{ explanations: string[] }>(
      'You explain why specific community resources fit a neurodivergent user. Be concise, warm, and specific.',
      `Barriers: ${barriers.map((b) => b.type).join(', ') || 'none'}\n` +
        `Resources (JSON): ${JSON.stringify(payload)}\n` +
        `Return JSON: {"explanations": ["sentence about resource 0", "sentence about resource 1", ...]}\n` +
        `One sentence (max 25 words) per resource, same order as input.`,
      { temperature: 0.5, maxTokens: 600 }
    )

    if (data && Array.isArray(data.explanations) && data.explanations.length === top.length) {
      const llmExplanations = data.explanations.map(String)
      // Append rule-based for any resources beyond the top batch
      return [...llmExplanations, ...resources.slice(10).map(ruleBased)]
    }
    return resources.map(ruleBased)
  }

  /**
   * Calculate agent's confidence in recommendations
   * Based on number of similar users and recommendation quality
   */
  private calculateConfidence(
    resources: ScoredResource[],
    similarUsersCount: number
  ): number {
    if (resources.length === 0) {
      return 0
    }

    // Base confidence from similar users count (0-50%)
    const userConfidence = Math.min((similarUsersCount / 50) * 50, 50)

    // Confidence from recommendation quality (0-50%)
    const avgScore = resources.reduce((sum, r) => sum + r.score, 0) / resources.length
    const qualityConfidence = (avgScore / 100) * 50

    // Total confidence (0-100%)
    const totalConfidence = userConfidence + qualityConfidence

    return Math.round(Math.min(totalConfidence, 100))
  }
}

// Export singleton instance
export const recommendationAgent = new RecommendationAgent()