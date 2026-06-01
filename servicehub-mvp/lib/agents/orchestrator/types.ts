import type { Barrier } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'
import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'

// Re-export for use in other orchestrator modules
export type { DiscoveredPattern }

export type RequestType = 'recommendations' | 'search' | 'validate_submission' | 'pattern_discovery'

export interface UserRequest {
  userId: string
  requestType: RequestType
  context: RequestContext
  barriers?: Barrier[]
}

export interface RequestContext {
  query?: string
  category?: string
  location?: any
  itemType?: 'rating' | 'resource' | 'user'
  item?: any
  isNewUser?: boolean
  needsDeepInsights?: boolean
  [key: string]: any
}

export interface OrchestratorResponse {
  result: any
  explanation?: string // Synthesis explanation
  agentsInvolved: string[]
  executionTime: number // milliseconds
  agentOutputs: AgentOutputs
  metadata?: OrchestrationMetadata
}

export interface AgentOutputs {
  RecommendationAgent?: RecommendationAgentOutput
  PatternAgent?: DiscoveredPattern[]
  ValidationAgent?: ValidationAgentOutput
  SearchService?: any[]
  [key: string]: any
}

export interface OrchestrationMetadata {
  patternInsights?: DiscoveredPattern[]
  validationResults?: ValidationAgentOutput[]
  conflicts?: AgentConflict[]
  recommendations?: any[]
  synthesis?: any // Synthesis result from Synthesis Engine
  executions?: AgentExecution[]
}

export interface AgentConflict {
  agent1: string
  agent2: string
  conflictType: 'recommendation_vs_validation' | 'pattern_vs_validation' | 'other'
  resolution: 'approve' | 'reject' | 'flag' | 'pending'
  description: string
}

export interface AgentExecution {
  agentName: string
  startTime: number
  endTime?: number
  duration?: number
  success: boolean
  error?: string
  output?: any
}

export interface OrchestrationLog {
  requestId: string
  userId: string
  requestType: RequestType
  startTime: number
  endTime?: number
  duration?: number
  agentsInvolved: string[]
  executions: AgentExecution[]
  conflicts?: AgentConflict[]
  result?: any
}