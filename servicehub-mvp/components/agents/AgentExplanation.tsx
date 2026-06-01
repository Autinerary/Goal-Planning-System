'use client'

import { Info, Lightbulb } from 'lucide-react'
import type { ScoredResource } from '@/lib/agents/recommendation-agent/types'

interface AgentExplanationProps {
  resource: ScoredResource
  explanation: string
  showDetails?: boolean
}

export default function AgentExplanation({
  resource,
  explanation,
  showDetails = false,
}: AgentExplanationProps) {
  return (
    <div className="space-y-2">
      {/* Main Explanation */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <div className="text-sm font-medium text-blue-900 mb-1">Why we recommend this</div>
          <div className="text-sm text-blue-800">{explanation}</div>
        </div>
      </div>

      {/* Detailed Metrics (if showDetails) */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>Match Score: {resource.score}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Info className="w-3 h-3" aria-hidden="true" />
            <span>
              {resource.similarUsersCount} {resource.similarUsersCount === 1 ? 'user' : 'users'} found helpful
            </span>
          </div>
          {resource.averageRatingFromSimilarUsers > 0 && (
            <div className="flex items-center gap-1">
              <Info className="w-3 h-3" aria-hidden="true" />
              <span>
                Avg Rating: {resource.averageRatingFromSimilarUsers.toFixed(1)}/5
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}