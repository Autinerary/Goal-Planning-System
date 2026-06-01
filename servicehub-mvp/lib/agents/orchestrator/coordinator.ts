import type {
  AgentOutputs,
  AgentConflict,
  RequestContext,
  DiscoveredPattern,
} from './types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

/**
 * Coordinator: Manages interactions between agents
 * Resolves conflicts, synthesizes outputs, and coordinates execution
 */
export class AgentCoordinator {
  /**
   * Resolve conflicts between agents
   * Example: Recommendation Agent suggests resource, but Validation Agent flags it
   */
  resolveAgentConflict(
    recommendation: RecommendationAgentOutput | undefined,
    validation: ValidationAgentOutput | undefined
  ): AgentConflict | null {
    if (!recommendation || !validation) {
      return null
    }

    // Conflict: Recommendation Agent suggests resource but Validation Agent flags it
    if (recommendation.confidence > 80 && validation.confidence < 50) {
      return {
        agent1: 'RecommendationAgent',
        agent2: 'ValidationAgent',
        conflictType: 'recommendation_vs_validation',
        resolution: 'flag',
        description: `Recommendation Agent suggests resource (${recommendation.confidence}% confidence) but Validation Agent flags it (${validation.confidence}% confidence)`,
      }
    }

    // Conflict: Pattern insights suggest category, but validation rejects it
    if (validation.decision === 'reject' && recommendation.confidence > 70) {
      return {
        agent1: 'PatternAgent',
        agent2: 'ValidationAgent',
        conflictType: 'pattern_vs_validation',
        resolution: 'flag',
        description: `Pattern Agent suggests category but Validation Agent rejects submission`,
      }
    }

    return null
  }

  /**
   * Apply pattern insights to search results (re-ranking)
   */
  applyPatternRanking(
    searchResults: any[],
    patterns: DiscoveredPattern[],
    barriers?: any[]
  ): any[] {
    if (!patterns || patterns.length === 0 || !searchResults) {
      return searchResults
    }

    // Find patterns relevant to user's barriers
    const relevantPatterns = patterns.filter((pattern) => {
      if (!barriers || barriers.length === 0) return false

      // Check if pattern matches user's barriers
      const patternBarriers = pattern.pattern.barrier_combination || []
      const userBarrierKeys = barriers.map((b) => `${b.category}:${b.type}`)

      return patternBarriers.some((pb: string) => userBarrierKeys.includes(pb))
    })

    if (relevantPatterns.length === 0) {
      return searchResults
    }

    // Boost resources that match pattern preferences
    const boostedResults = searchResults.map((result) => {
      let boost = 0

      // Check if resource category matches pattern preferences
      relevantPatterns.forEach((pattern) => {
        const preferredCategories = pattern.pattern.resource_categories || []
        if (preferredCategories.includes(result.category)) {
          boost += pattern.confidence / 100 // Add boost based on pattern confidence
        }
      })

      return {
        ...result,
        _patternBoost: boost,
        _originalScore: result.score || 0,
        _finalScore: (result.score || 0) + boost,
      }
    })

    // Re-rank by final score
    return boostedResults.sort((a, b) => (b._finalScore || 0) - (a._finalScore || 0))
  }

  /**
   * Validate recommended resources using Validation Agent
   */
  async validateRecommendations(
    resources: any[],
    validationAgent: any
  ): Promise<Array<{ resource: any; validation: ValidationAgentOutput | null }>> {
    if (!resources || resources.length === 0) {
      return []
    }

    // Validate top recommendations (limit to avoid performance issues)
    const topResources = resources.slice(0, 10)
    const validatedResources = await Promise.all(
      topResources.map(async (resource) => {
        try {
          // Get user history would be passed in real implementation
          const validation = await validationAgent.validate({
            itemType: 'resource',
            item: resource,
            context: {
              userId: resource.submitted_by || '',
            },
          })

          return {
            resource,
            validation,
          }
        } catch (error) {
          console.error(`Error validating resource ${resource.id}:`, error)
          return {
            resource,
            validation: null,
          }
        }
      })
    )

    return validatedResources
  }

  /**
   * Synthesize outputs from multiple agents
   */
  synthesizeResults(
    agentOutputs: AgentOutputs,
    conflicts?: AgentConflict[]
  ): any {
    const synthesis: any = {
      primaryResult: null,
      enhancements: [],
      warnings: [],
    }

    // Get primary result based on request type
    if (agentOutputs.RecommendationAgent) {
      synthesis.primaryResult = agentOutputs.RecommendationAgent.resources
      synthesis.confidence = agentOutputs.RecommendationAgent.confidence
    } else if (agentOutputs.SearchService) {
      synthesis.primaryResult = agentOutputs.SearchService
    } else if (agentOutputs.ValidationAgent) {
      synthesis.primaryResult = agentOutputs.ValidationAgent
    }

    // Add pattern insights as enhancements
    if (agentOutputs.PatternAgent && Array.isArray(agentOutputs.PatternAgent)) {
      synthesis.enhancements.push({
        type: 'pattern_insights',
        data: agentOutputs.PatternAgent,
      })
    }

    // Add validation results as enhancements
    if (agentOutputs.ValidationAgent) {
      synthesis.enhancements.push({
        type: 'validation_results',
        data: agentOutputs.ValidationAgent,
      })
    }

    // Add conflicts as warnings
    if (conflicts && conflicts.length > 0) {
      synthesis.warnings = conflicts.map((c) => ({
        type: 'agent_conflict',
        description: c.description,
        resolution: c.resolution,
      }))
    }

    return synthesis
  }

  /**
   * Make final decision when agents conflict
   */
  makeValidationDecision(validationResult: ValidationAgentOutput): any {
    // Orchestrator makes final decision based on agent output
    // Can override agent decision if needed (for future ML-based decision making)
    return {
      decision: validationResult.decision,
      confidence: validationResult.confidence,
      reasons: validationResult.reasons,
      trustScore: validationResult.trustScore,
      recommendedAction: validationResult.recommendedAction,
      metadata: validationResult.metadata,
    }
  }

  /**
   * Merge pattern insights into recommendation context
   */
  enhanceRecommendationsWithPatterns(
    recommendations: RecommendationAgentOutput,
    patterns: DiscoveredPattern[]
  ): RecommendationAgentOutput {
    if (!patterns || patterns.length === 0) {
      return recommendations
    }

    // Filter patterns relevant to recommended resources
    const relevantPatterns = patterns.filter((pattern) => {
      // Check if pattern relates to any recommended resource categories
      const resourceCategories = recommendations.resources.map((r) => r.category)
      const patternCategories = pattern.pattern.resource_categories || []
      return patternCategories.some((pc) => resourceCategories.includes(pc))
    })

    // Add pattern insights to explanations
    const enhancedExplanations = recommendations.explanations.map((explanation, index) => {
      const resource = recommendations.resources[index]
      if (!resource) return explanation

      // Find relevant patterns for this resource
      const resourcePatterns = relevantPatterns.filter((pattern) => {
        const patternCategories = pattern.pattern.resource_categories || []
        return patternCategories.includes(resource.category)
      })

      if (resourcePatterns.length > 0) {
        const patternInsight = resourcePatterns[0].insight
        return `${explanation} (Pattern: ${patternInsight})`
      }

      return explanation
    })

    return {
      ...recommendations,
      explanations: enhancedExplanations,
    }
  }
}

export const agentCoordinator = new AgentCoordinator()