import type { Resource, UserBarrier } from '@/types/database'

export type PatternType = 'barrier_combination' | 'resource_affinity' | 'intersectionality' | 'non_obvious'

export type PatternScope = 'global' | 'category' | 'location'

export interface PatternAgentInput {
  scope?: PatternScope
  minimumSupport?: number // Minimum occurrences to be considered a pattern
  category?: string // If scope is 'category'
  location?: string // If scope is 'location'
}

export interface DiscoveredPattern {
  id?: string
  type: PatternType
  pattern: PatternData
  frequency: number
  confidence: number // 0-100%
  insight: string // Human-readable discovery
  scope: PatternScope
  category?: string
  location?: string
  discovered_at?: string
  metadata?: PatternMetadata
}

export interface PatternData {
  // For barrier_combination
  barrier_combination?: string[]
  avg_severity?: number
  
  // For resource_affinity
  source_resource_id?: string
  related_resource_ids?: string[]
  affinity_strength?: number
  
  // For intersectionality
  barriers?: string[]
  demographics?: any
  resource_categories?: string[]
  location_pattern?: string
  
  // For non_obvious
  connection_type?: string
  description?: string
  [key: string]: any
}

export interface PatternMetadata {
  statistical_significance?: number
  novelty_score?: number // How surprising vs expected
  actionability_score?: number // How useful for recommendations
  support_count?: number // Number of supporting data points
  confidence_interval?: number[]
}

export interface BarrierCombination {
  combination: string[]
  frequency: number
  avg_severity: number
  user_ids: string[]
}

export interface ResourceAffinity {
  source_resource_id: string
  related_resource_id: string
  user_count: number
  strength: number // 0-1 correlation
  avg_rating_both: number
}

export interface IntersectionalityPattern {
  barriers: string[]
  demographics?: any
  resource_categories: string[]
  location?: string
  frequency: number
  significance: number
}