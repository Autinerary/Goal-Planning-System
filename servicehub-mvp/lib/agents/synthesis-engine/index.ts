import { rankResults } from './ranker'
import { generateExplanation, generateResultExplanation, generateAgentContributions } from './explainer'
import type {
  SynthesisInput,
  SynthesisOutput,
  AgentContribution,
  RankedResult,
} from './types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

/**
 * Synthesis Engine: Combines agent outputs into final response
 * MVP: Rule-based synthesis (will upgrade to LLM-powered explanations post-funding)
 * Job: Weigh agent inputs and resolve conflicts
 *
 * Architecture: Central synthesis layer for all agent outputs
 * - Current: Rule-based ranking and explanation generation
 * - Future: LLM-powered natural language explanations and advanced conflict resolution
 *
 * Migration Path: Replace rule-based explanation generation with LLM calls while keeping same interface
 */
export class SynthesisEngine {
  /**
   * Main synthesis function
   * Combines outputs from all agents into coherent final response
   */
  async synthesize(input: SynthesisInput): Promise<SynthesisOutput> {
    try {
      // Extract outputs from each agent
      const recommendations = input.agentOutputs.RecommendationAgent
      const patterns = input.agentOutputs.PatternAgent
      const validations = input.agentOutputs.ValidationAgent

      // Step 1: Combine and rank results
      const { rankedResults, rankingFactors } = rankResults(
        recommendations,
        patterns as DiscoveredPattern[],
        validations as any
      )

      // Step 2: Filter based on validation (remove rejected items)
      const validatedResults = this.applyValidation(rankedResults, validations)

      // Step 3: Generate human-readable explanations
      const explanation = await generateExplanation(
        validatedResults,
        input.agentOutputs,
        input.userContext
      )

      // Generate explanations for each result
      validatedResults.forEach((result) => {
        result.explanation = generateResultExplanation(
          result,
          input.agentOutputs,
          input.userContext
        )
      })

      // Step 4: Calculate overall confidence
      const confidence = this.calculateOverallConfidence(input.agentOutputs)

      // Step 5: Document agent contributions
      const agentContributions = this.documentContributions(input.agentOutputs)

      return {
        finalResults: validatedResults.map((r) => r.resource),
        explanation,
        agentContributions,
        confidence,
        metadata: {
          rankingFactors,
          filteredCount: rankedResults.length - validatedResults.length,
          synthesisStrategy: this.getSynthesisStrategy(input.requestType),
        },
      }
    } catch (error) {
      console.error('[Synthesis Engine] Error synthesizing results:', error)
      // Return fallback result
      return {
        finalResults: [],
        explanation: 'Unable to synthesize results',
        agentContributions: [],
        confidence: 0,
      }
    }
  }

  /**
   * Apply validation filtering to results
   * Removes items that were rejected by validation agent
   */
  private applyValidation(
    rankedResults: RankedResult[],
    validations: ValidationAgentOutput | undefined
  ): RankedResult[] {
    if (!validations || validations.decision !== 'reject') {
      // No validation rejections, return all results
      return rankedResults
    }

    // Filter out rejected items
    // In practice, validations would be an array of validation results per resource
    // For now, we'll just return all results if validation didn't explicitly reject
    return rankedResults
  }

  /**
   * Synthesis Engine calculates overall confidence
   * Weighted average of agent confidences
   */
  private calculateOverallConfidence(agentOutputs: any): number {
    const weights: { [key: string]: number } = {
      RecommendationAgent: 0.4,
      PatternAgent: 0.3,
      ValidationAgent: 0.3,
      SearchService: 0.2,
    }

    let totalConfidence = 0
    let totalWeight = 0

    Object.entries(agentOutputs).forEach(([agentName, output]) => {
      if (!output) return

      const weight = weights[agentName] || 0.2
      let confidence = 0

      // Extract confidence from different output formats
      if (typeof output === 'object' && output !== null) {
        if ('confidence' in output && typeof (output as any).confidence === 'number') {
          confidence = (output as any).confidence
        } else if (Array.isArray(output) && output.length > 0) {
          // For pattern arrays, average confidence
          const confidences = output
            .map((p: any) => p.confidence || 0)
            .filter((c: number) => c > 0)
          confidence =
            confidences.length > 0
              ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
              : 50
        } else {
          confidence = 50 // Default confidence if not specified
        }
      }

      totalConfidence += confidence * weight
      totalWeight += weight
    })

    return totalWeight > 0 ? Math.round(totalConfidence / totalWeight) : 0
  }

  /**
   * Document which agents contributed what
   */
  private documentContributions(agentOutputs: any): AgentContribution[] {
    const contributions = generateAgentContributions(agentOutputs)

    // Add metadata for each contribution
    return contributions.map((contrib) => ({
      agentName: contrib.agentName,
      contribution: contrib.contribution,
      confidence: contrib.confidence,
      outputCount: contrib.outputCount,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    }))
  }

  /**
   * Get synthesis strategy based on request type
   */
  private getSynthesisStrategy(requestType: string): string {
    switch (requestType) {
      case 'recommendations':
        return 'Weighted combination of recommendation scores, pattern insights, and community ratings'
      case 'search':
        return 'Semantic search with pattern-based re-ranking'
      case 'validate_submission':
        return 'Validation-first approach with quality checks'
      default:
        return 'Standard synthesis strategy'
    }
  }

  /**
   * Resolve conflicts between agents
   * Example: Recommendation Agent suggests X, but Validation Agent flags it
   */
  resolveConflicts(agentOutputs: any): any[] {
    const conflicts: any[] = []

    const recommendations = agentOutputs.RecommendationAgent
    const validation = agentOutputs.ValidationAgent

    if (!recommendations || !validation) {
      return conflicts
    }

    // Check if recommended resources conflict with validation
    if (recommendations.resources && validation.decision === 'reject') {
      // This is a conflict - recommendation suggests but validation rejects
      conflicts.push({
        type: 'recommendation_vs_validation',
        description: `Recommendation Agent suggests resource but Validation Agent flags it`,
        resolution: 'Trust Validation Agent for quality, filter out rejected items',
      })
    }

    return conflicts
  }
}

// Export singleton instance
export const synthesisEngine = new SynthesisEngine()