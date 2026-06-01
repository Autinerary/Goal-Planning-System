'use client'

import { Sparkles } from 'lucide-react'
import ResourceCard from '@/components/resources/ResourceCard'
import AgentExplanation from './AgentExplanation'
import ConfidenceIndicator from './ConfidenceIndicator'
import SynthesisExplanation from './SynthesisExplanation'
import AgentContributionBreakdown from './AgentContributionBreakdown'
import type { ScoredResource } from '@/lib/agents/recommendation-agent/types'
import type { AgentContribution } from '@/lib/agents/synthesis-engine/types'

interface RecommendationResultProps {
  resources: ScoredResource[]
  explanations?: string[]
  confidence: number
  loading?: boolean
  showConfidence?: boolean
  showExplanations?: boolean
  synthesisExplanation?: string
  agentContributions?: AgentContribution[]
  showSynthesis?: boolean
}

export default function RecommendationResult({
  resources,
  explanations,
  confidence,
  loading = false,
  showConfidence = true,
  showExplanations = true,
  synthesisExplanation,
  agentContributions,
  showSynthesis = true,
}: RecommendationResultProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-blue-600" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-gray-900">AI Agent Recommendations</h2>
        </div>
        <div className="text-sm text-gray-600">Loading recommendations...</div>
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-blue-600" aria-hidden="true" />
          <h2 className="text-2xl font-bold text-gray-900">AI Agent Recommendations</h2>
        </div>
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No recommendations yet</h3>
          <p className="text-sm text-gray-600">
            Complete your profile to get personalized recommendations from our AI agent.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Recommended by AI Agent</h2>
            <p className="text-sm text-gray-600 mt-1">
              Personalized recommendations based on your barrier profile
            </p>
          </div>
        </div>

        {showConfidence && (
          <ConfidenceIndicator confidence={confidence} size="md" />
        )}
      </div>

      {/* Overall Synthesis Explanation */}
      {showSynthesis && synthesisExplanation && (
        <div className="mb-6">
          <SynthesisExplanation
            explanation={synthesisExplanation}
            variant="detailed"
            showDetails={false}
          />
        </div>
      )}

      {/* Agent Contribution Breakdown */}
      {showSynthesis && agentContributions && agentContributions.length > 0 && (
        <div className="mb-6">
          <AgentContributionBreakdown
            contributions={agentContributions}
            overallConfidence={confidence}
            showOverallConfidence={showConfidence}
          />
        </div>
      )}

      {/* Resources Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {resources.map((resource, index) => (
          <div key={resource.id} className="space-y-3">
            <ResourceCard
              resource={resource}
              averageRating={resource.averageRatingFromSimilarUsers || 0}
              ratingCount={resource.similarUsersCount || 0}
              showBadges={true}
            />

            {/* Match Score Badge */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                <Sparkles className="w-3 h-3" aria-hidden="true" />
                {resource.score}% match
              </div>
            </div>

            {/* Agent Explanation */}
            {showExplanations && explanations && explanations[index] && (
              <AgentExplanation
                resource={resource}
                explanation={explanations[index]}
                showDetails={false}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}