export type ItemType = 'rating' | 'resource' | 'user'
export type ValidationDecision = 'approve' | 'reject' | 'flag_for_review'

export interface ValidationAgentInput {
  itemType: ItemType
  item: any // Rating, Resource, or User data
  context: {
    userId: string
    userHistory?: UserHistory
  }
}

export interface ValidationAgentOutput {
  decision: ValidationDecision
  confidence: number // 0-100%
  reasons: string[]
  trustScore: number // 0-100
  recommendedAction: string
  metadata?: ValidationMetadata
}

export interface ValidationMetadata {
  spamScore?: number
  contentScore?: number
  behavioralScore?: number
  abuseLikelihood?: number
  timestamp: string
}

export interface ValidationCheck {
  name: string
  passed: boolean
  score: number // 0-100
  issues: string[]
}

export interface UserHistory {
  accountAgeDays: number
  ratingsCount: number
  resourcesSubmitted: number
  helpfulVotes: number
  violations: number
  recentActivity?: RecentActivity
}

export interface RecentActivity {
  last24h: number
  last7d: number
  ratings: Array<{ rating: number; timestamp: string }>
  timestamps: string[]
  resources: string[]
}

export interface SpamCheckResult {
  isSpam: boolean
  spamScore: number // 0-100
  indicators: string[]
}

export interface TrustScoreResult {
  trustScore: number // 0-100
  factors: {
    accountAge: number
    contributions: number
    helpfulVotes: number
    violations: number
    consistency: number
  }
}

export interface ContentCheckResult {
  passed: boolean
  score: number // 0-100
  issues: string[]
}