import type { RecommendationAgentOutput } from '@/lib/agents/recommendation-agent/types'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'
import type { Barrier } from '@/lib/agents/recommendation-agent/types'

export interface SynthesisInput {
  agentOutputs: AgentOutputs
  userContext: UserContext
  requestType: 'recommendations' | 'search' | 'validate_submission' | 'pattern_discovery'
}

export interface AgentOutputs {
  RecommendationAgent?: RecommendationAgentOutput
  PatternAgent?: DiscoveredPattern[]
  ValidationAgent?: ValidationAgentOutput
  SearchService?: any[]
  [key: string]: any
}

export interface UserContext {
  userId: string
  barriers?: Barrier[]
  location?: any
  isNewUser?: boolean
  preferences?: any
  [key: string]: any
}

export interface SynthesisOutput {
  finalResults: any[]
  explanation: string
  agentContributions: AgentContribution[]
  confidence: number
  metadata?: SynthesisMetadata
}

export interface SynthesisMetadata {
  rankingFactors?: RankingFactor[]
  filteredCount?: number
  conflicts?: any[]
  synthesisStrategy?: string
}

export interface RankingFactor {
  factor: string
  weight: number
  contribution: number
}

export interface AgentContribution {
  agentName: string
  contribution: string
  confidence: number
  outputCount?: number
  metadata?: any
}

export interface RankedResult {
  resource: any
  baseScore: number
  patternBoost: number
  validationBoost: number
  communityRating: number
  finalScore: number
  explanation: string
  agentContributions: string[]
}