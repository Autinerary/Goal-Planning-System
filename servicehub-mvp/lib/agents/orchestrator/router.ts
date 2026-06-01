import type { UserRequest, RequestType } from './types'

/**
 * Router: Determines which agents to activate for each request type
 * Makes strategic decisions about agent involvement
 */
export class AgentRouter {
  /**
   * Determine which agents should be involved for a request
   */
  shouldInvolvePatternAgent(request: UserRequest): boolean {
    // Strategic decision: use Pattern Agent for first-time users or complex queries
    return (
      request.context.isNewUser === true ||
      request.context.needsDeepInsights === true ||
      request.requestType === 'recommendations' ||
      request.requestType === 'search'
    )
  }

  /**
   * Determine if validation agent should be involved
   */
  shouldInvolveValidationAgent(request: UserRequest): boolean {
    return (
      request.requestType === 'validate_submission' ||
      request.requestType === 'recommendations' // Validate recommended resources
    )
  }

  /**
   * Determine if recommendation agent should be involved
   */
  shouldInvolveRecommendationAgent(request: UserRequest): boolean {
    return (
      request.requestType === 'recommendations' ||
      (request.requestType === 'search' && request.context.enhanceWithRecommendations === true)
    )
  }

  /**
   * Get list of agents to activate for a request
   */
  getAgentsToActivate(request: UserRequest): string[] {
    const agents: string[] = []

    switch (request.requestType) {
      case 'recommendations':
        agents.push('RecommendationAgent')
        if (this.shouldInvolvePatternAgent(request)) {
          agents.push('PatternAgent')
        }
        if (this.shouldInvolveValidationAgent(request)) {
          agents.push('ValidationAgent')
        }
        break

      case 'search':
        agents.push('SearchService')
        if (this.shouldInvolvePatternAgent(request)) {
          agents.push('PatternAgent')
        }
        if (this.shouldInvolveRecommendationAgent(request)) {
          agents.push('RecommendationAgent')
        }
        break

      case 'validate_submission':
        agents.push('ValidationAgent')
        break

      case 'pattern_discovery':
        agents.push('PatternAgent')
        break

      default:
        break
    }

    return agents
  }

  /**
   * Determine execution order of agents
   */
  getExecutionOrder(request: UserRequest): string[] {
    const agents = this.getAgentsToActivate(request)
    const order: string[] = []

    switch (request.requestType) {
      case 'recommendations':
        // Pattern Agent first (for insights), then Recommendation Agent, then Validation
        if (agents.includes('PatternAgent')) order.push('PatternAgent')
        if (agents.includes('RecommendationAgent')) order.push('RecommendationAgent')
        if (agents.includes('ValidationAgent')) order.push('ValidationAgent')
        break

      case 'search':
        // Search Service first, then Pattern Agent (for re-ranking), then Recommendation Agent
        if (agents.includes('SearchService')) order.push('SearchService')
        if (agents.includes('PatternAgent')) order.push('PatternAgent')
        if (agents.includes('RecommendationAgent')) order.push('RecommendationAgent')
        break

      case 'validate_submission':
        // Only Validation Agent
        if (agents.includes('ValidationAgent')) order.push('ValidationAgent')
        break

      case 'pattern_discovery':
        // Only Pattern Agent
        if (agents.includes('PatternAgent')) order.push('PatternAgent')
        break

      default:
        break
    }

    return order
  }
}

export const agentRouter = new AgentRouter()