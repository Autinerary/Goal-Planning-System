import { recommendationAgent } from '@/lib/agents/recommendation-agent'
import { patternAgent } from '@/lib/agents/pattern-agent'
import { validationAgent } from '@/lib/agents/validation-agent'
import { synthesisEngine } from '@/lib/agents/synthesis-engine'
import { agentRouter } from './router'
import { agentCoordinator } from './coordinator'
import { searchResources } from '@/lib/supabase/queries'
import { semanticResourceSearch } from '@/lib/supabase/vector-queries'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import type {
  UserRequest,
  OrchestratorResponse,
  AgentOutputs,
  AgentExecution,
  AgentConflict,
} from './types'
import type { RecommendationAgentInput } from '@/lib/agents/recommendation-agent/types'
import type { PatternAgentInput } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentInput } from '@/lib/agents/validation-agent/types'
import type { SynthesisInput } from '@/lib/agents/synthesis-engine/types'

/**
 * Orchestrator: Coordinates all agents
 * MVP: Sequential coordination (will upgrade to parallel execution post-funding)
 * Job: Route user requests to appropriate agents and manage their coordination
 *
 * Architecture: Central coordination layer for all agents
 * - Current: Sequential agent execution with conflict resolution
 * - Future: Parallel execution using message queues (RabbitMQ) and advanced conflict resolution
 *
 * Migration Path: Replace sequential coordination with parallel execution and message queues
 */
export class Orchestrator {
  private recommendationAgent = recommendationAgent
  private patternAgent = patternAgent
  private validationAgent = validationAgent
  private router = agentRouter
  private coordinator = agentCoordinator

  /**
   * Main orchestration function
   * Routes requests to appropriate agents and coordinates their execution
   */
  async handleRequest(request: UserRequest): Promise<OrchestratorResponse> {
    const startTime = Date.now()
    const agentsInvolved: string[] = []
    const agentOutputs: AgentOutputs = {}
    const executions: AgentExecution[] = []
    const conflicts: AgentConflict[] = []

    try {
      // Orchestrator decides which agents to activate
      const executionOrder = this.router.getExecutionOrder(request)

      switch (request.requestType) {
        case 'recommendations':
          return await this.handleRecommendationRequest(request, startTime)

        case 'search':
          return await this.handleSearchRequest(request, startTime)

        case 'validate_submission':
          return await this.handleValidationRequest(request, startTime)

        case 'pattern_discovery':
          return await this.handlePatternDiscoveryRequest(request, startTime)

        default:
          throw new Error(`Unknown request type: ${request.requestType}`)
      }
    } catch (error) {
      console.error('[Orchestrator] Error handling request:', error)
      return {
        result: { error: 'Orchestration failed', message: (error as Error).message },
        agentsInvolved,
        executionTime: Date.now() - startTime,
        agentOutputs,
      }
    }
  }

  /**
   * Orchestrator coordinates recommendation flow
   */
  private async handleRecommendationRequest(
    request: UserRequest,
    startTime: number
  ): Promise<OrchestratorResponse> {
    const agentsInvolved: string[] = []
    const agentOutputs: AgentOutputs = {}
    const executions: AgentExecution[] = []

    // Step 1: Activate Pattern Agent to get current insights
    let patterns: any[] = []
    if (this.router.shouldInvolvePatternAgent(request)) {
      console.log('[Orchestrator] Activating Pattern Recognition Agent...')
      const patternStartTime = Date.now()

      try {
        patterns = await this.patternAgent.discoverPatterns({
          scope: 'global',
          minimumSupport: 5,
        } as PatternAgentInput)

        agentsInvolved.push('PatternAgent')
        agentOutputs.PatternAgent = patterns

        executions.push({
          agentName: 'PatternAgent',
          startTime: patternStartTime,
          endTime: Date.now(),
          duration: Date.now() - patternStartTime,
          success: true,
          output: patterns,
        })
      } catch (error) {
        console.error('[Orchestrator] Pattern Agent error:', error)
        executions.push({
          agentName: 'PatternAgent',
          startTime: patternStartTime,
          endTime: Date.now(),
          duration: Date.now() - patternStartTime,
          success: false,
          error: (error as Error).message,
        })
      }
    }

    // Step 2: Activate Recommendation Agent with pattern insights
    console.log('[Orchestrator] Activating Recommendation Agent...')
    const recommendationStartTime = Date.now()

    try {
      if (!request.barriers || request.barriers.length === 0) {
        throw new Error('Barriers required for recommendations')
      }

      const recommendationInput: RecommendationAgentInput = {
        userId: request.userId,
        barriers: request.barriers,
        location: request.context.location,
        context: request.context.query || request.context.context,
      }

      const recommendations = await this.recommendationAgent.generateRecommendations(
        recommendationInput
      )

      // Enhance recommendations with pattern insights
      if (patterns && patterns.length > 0) {
        const enhanced = this.coordinator.enhanceRecommendationsWithPatterns(
          recommendations,
          patterns
        )
        agentOutputs.RecommendationAgent = enhanced
      } else {
        agentOutputs.RecommendationAgent = recommendations
      }

      agentsInvolved.push('RecommendationAgent')

      executions.push({
        agentName: 'RecommendationAgent',
        startTime: recommendationStartTime,
        endTime: Date.now(),
        duration: Date.now() - recommendationStartTime,
        success: true,
        output: recommendations,
      })
    } catch (error) {
      console.error('[Orchestrator] Recommendation Agent error:', error)
      executions.push({
        agentName: 'RecommendationAgent',
        startTime: recommendationStartTime,
        endTime: Date.now(),
        duration: Date.now() - recommendationStartTime,
        success: false,
        error: (error as Error).message,
      })
      throw error
    }

    // Step 3: Validate recommended resources (optional quality check)
    if (this.router.shouldInvolveValidationAgent(request)) {
      console.log('[Orchestrator] Running quality validation...')
      const validationStartTime = Date.now()

      try {
        const recommendations = agentOutputs.RecommendationAgent as any
        if (recommendations && recommendations.resources) {
          const validatedResources = await this.coordinator.validateRecommendations(
            recommendations.resources.slice(0, 5), // Limit to top 5 for performance
            this.validationAgent
          )

          // Check for conflicts
          validatedResources.forEach(({ resource, validation }) => {
            if (validation) {
              const conflict = this.coordinator.resolveAgentConflict(
                recommendations,
                validation
              )
              if (conflict) {
                // conflicts.push(conflict) // Would track conflicts in real implementation
              }
            }
          })

          agentsInvolved.push('ValidationAgent')
          executions.push({
            agentName: 'ValidationAgent',
            startTime: validationStartTime,
            endTime: Date.now(),
            duration: Date.now() - validationStartTime,
            success: true,
            output: validatedResources,
          })
        }
      } catch (error) {
        console.error('[Orchestrator] Validation Agent error:', error)
        executions.push({
          agentName: 'ValidationAgent',
          startTime: validationStartTime,
          endTime: Date.now(),
          duration: Date.now() - validationStartTime,
          success: false,
          error: (error as Error).message,
        })
      }
    }

    // Step 4: Synthesize results using Synthesis Engine
    const synthesisInput: SynthesisInput = {
      agentOutputs,
      userContext: {
        userId: request.userId,
        barriers: request.barriers || [],
        location: request.context.location,
        isNewUser: request.context.isNewUser,
      },
      requestType: 'recommendations',
    }

    const synthesisResult = await synthesisEngine.synthesize(synthesisInput)

    return {
      result: synthesisResult.finalResults,
      explanation: synthesisResult.explanation,
      agentsInvolved,
      executionTime: Date.now() - startTime,
      agentOutputs,
      metadata: {
        patternInsights: patterns,
        executions,
        synthesis: synthesisResult,
      },
    }
  }

  /**
   * Orchestrator handles search with agent enhancement
   */
  private async handleSearchRequest(
    request: UserRequest,
    startTime: number
  ): Promise<OrchestratorResponse> {
    const agentsInvolved: string[] = ['SearchService']
    const agentOutputs: AgentOutputs = {}
    const executions: AgentExecution[] = []

    // Basic search (semantic + keyword)
    const searchStartTime = Date.now()
    let searchResults: any[] = []

    try {
      if (request.context.query) {
        // Semantic search using vector database
        searchResults = await semanticResourceSearch(
          request.context.query,
          20,
          0.7,
          request.context.category
        )
      } else {
        // Keyword search
        const searchResponse = await searchResources(
          {
            query: request.context.query,
            categories: request.context.category ? [request.context.category] : undefined,
            status: 'approved',
          },
          'relevance',
          1,
          20
        )
        searchResults = searchResponse.results || []
      }

      agentOutputs.SearchService = searchResults

      executions.push({
        agentName: 'SearchService',
        startTime: searchStartTime,
        endTime: Date.now(),
        duration: Date.now() - searchStartTime,
        success: true,
        output: searchResults,
      })
    } catch (error) {
      console.error('[Orchestrator] Search Service error:', error)
      executions.push({
        agentName: 'SearchService',
        startTime: searchStartTime,
        endTime: Date.now(),
        duration: Date.now() - searchStartTime,
        success: false,
        error: (error as Error).message,
      })
    }

    // Enhance with patterns: "Users with your barriers often choose these"
    if (this.router.shouldInvolvePatternAgent(request)) {
      console.log('[Orchestrator] Activating Pattern Agent for search enhancement...')
      const patternStartTime = Date.now()

      try {
        const patterns = await this.patternAgent.discoverPatterns({
          scope: request.context.category ? 'category' : 'global',
          category: request.context.category,
          minimumSupport: 3,
        } as PatternAgentInput)

        // Re-rank results using pattern insights
        const enhancedResults = this.coordinator.applyPatternRanking(
          searchResults,
          patterns,
          request.barriers
        )

        agentsInvolved.push('PatternAgent')
        agentOutputs.PatternAgent = patterns
        agentOutputs.SearchService = enhancedResults

        executions.push({
          agentName: 'PatternAgent',
          startTime: patternStartTime,
          endTime: Date.now(),
          duration: Date.now() - patternStartTime,
          success: true,
          output: patterns,
        })
      } catch (error) {
        console.error('[Orchestrator] Pattern Agent error:', error)
        executions.push({
          agentName: 'PatternAgent',
          startTime: patternStartTime,
          endTime: Date.now(),
          duration: Date.now() - patternStartTime,
          success: false,
          error: (error as Error).message,
        })
      }
    }

    // Synthesize search results
    const synthesisInput: SynthesisInput = {
      agentOutputs,
      userContext: {
        userId: request.userId,
        barriers: request.barriers || [],
        location: request.context.location,
      },
      requestType: 'search',
    }

    const synthesisResult = await synthesisEngine.synthesize(synthesisInput)

    return {
      result: synthesisResult.finalResults.length > 0 ? synthesisResult.finalResults : searchResults,
      explanation: synthesisResult.explanation,
      agentsInvolved,
      executionTime: Date.now() - startTime,
      agentOutputs,
      metadata: {
        executions,
        synthesis: synthesisResult,
      },
    }
  }

  /**
   * Orchestrator handles content validation
   */
  private async handleValidationRequest(
    request: UserRequest,
    startTime: number
  ): Promise<OrchestratorResponse> {
    const agentsInvolved: string[] = ['ValidationAgent']
    const agentOutputs: AgentOutputs = {}
    const executions: AgentExecution[] = []

    console.log('[Orchestrator] Activating Validation Agent...')
    const validationStartTime = Date.now()

    try {
      const userHistory = await getUserHistory(request.userId)

      const validationInput: ValidationAgentInput = {
        itemType: request.context.itemType || 'rating',
        item: request.context.item,
        context: {
          userId: request.userId,
          userHistory,
        },
      }

      const validationResult = await this.validationAgent.validate(validationInput)

      // Orchestrator makes final decision based on agent output
      const finalDecision = this.coordinator.makeValidationDecision(validationResult)

      agentOutputs.ValidationAgent = validationResult

      executions.push({
        agentName: 'ValidationAgent',
        startTime: validationStartTime,
        endTime: Date.now(),
        duration: Date.now() - validationStartTime,
        success: true,
        output: validationResult,
      })

      return {
        result: finalDecision,
        agentsInvolved,
        executionTime: Date.now() - startTime,
        agentOutputs,
        metadata: {
          executions,
        },
      }
    } catch (error) {
      console.error('[Orchestrator] Validation Agent error:', error)
      executions.push({
        agentName: 'ValidationAgent',
        startTime: validationStartTime,
        endTime: Date.now(),
        duration: Date.now() - validationStartTime,
        success: false,
        error: (error as Error).message,
      })

      throw error
    }
  }

  /**
   * Handle pattern discovery request
   */
  private async handlePatternDiscoveryRequest(
    request: UserRequest,
    startTime: number
  ): Promise<OrchestratorResponse> {
    const agentsInvolved: string[] = ['PatternAgent']
    const agentOutputs: AgentOutputs = {}
    const executions: AgentExecution[] = []

    console.log('[Orchestrator] Activating Pattern Recognition Agent...')
    const patternStartTime = Date.now()

    try {
      const patterns = await this.patternAgent.discoverPatterns(
        (request.context as any) as PatternAgentInput
      )

      agentOutputs.PatternAgent = patterns

      executions.push({
        agentName: 'PatternAgent',
        startTime: patternStartTime,
        endTime: Date.now(),
        duration: Date.now() - patternStartTime,
        success: true,
        output: patterns,
      })

      return {
        result: patterns,
        agentsInvolved,
        executionTime: Date.now() - startTime,
        agentOutputs,
        metadata: {
          executions,
        },
      }
    } catch (error) {
      console.error('[Orchestrator] Pattern Agent error:', error)
      executions.push({
        agentName: 'PatternAgent',
        startTime: patternStartTime,
        endTime: Date.now(),
        duration: Date.now() - patternStartTime,
        success: false,
        error: (error as Error).message,
      })

      throw error
    }
  }
}

// Export singleton instance
export const orchestrator = new Orchestrator()