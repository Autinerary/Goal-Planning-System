'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles, Shield, TrendingUp, Search } from 'lucide-react'
import type { AgentContribution } from '@/lib/agents/synthesis-engine/types'

interface AgentContributionBreakdownProps {
  contributions: AgentContribution[]
  overallConfidence?: number
  showOverallConfidence?: boolean
}

const agentIcons: { [key: string]: any } = {
  RecommendationAgent: TrendingUp,
  'Recommendation Agent': TrendingUp,
  PatternAgent: Sparkles,
  'Pattern Recognition Agent': Sparkles,
  ValidationAgent: Shield,
  'Validation Agent': Shield,
  SearchService: Search,
  'Search Service': Search,
}

const agentColors: { [key: string]: string } = {
  RecommendationAgent: 'bg-purple-100 text-purple-800 border-purple-200',
  'Recommendation Agent': 'bg-purple-100 text-purple-800 border-purple-200',
  PatternAgent: 'bg-blue-100 text-blue-800 border-blue-200',
  'Pattern Recognition Agent': 'bg-blue-100 text-blue-800 border-blue-200',
  ValidationAgent: 'bg-green-100 text-green-800 border-green-200',
  'Validation Agent': 'bg-green-100 text-green-800 border-green-200',
  SearchService: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'Search Service': 'bg-yellow-100 text-yellow-800 border-yellow-200',
}

export default function AgentContributionBreakdown({
  contributions,
  overallConfidence,
  showOverallConfidence = true,
}: AgentContributionBreakdownProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!contributions || contributions.length === 0) {
    return null
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gray-600" aria-hidden="true" />
          <span className="font-semibold text-gray-900">
            Agent Contributions ({contributions.length} {contributions.length === 1 ? 'agent' : 'agents'})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showOverallConfidence && overallConfidence !== undefined && (
            <span className="text-sm text-gray-600">
              Overall: {overallConfidence}% confidence
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 bg-white space-y-3">
          {contributions.map((contribution, index) => {
            const Icon = agentIcons[contribution.agentName] || Sparkles
            const colorClass = agentColors[contribution.agentName] || 'bg-gray-100 text-gray-800 border-gray-200'

            return (
              <div
                key={index}
                className={`p-3 rounded-lg border ${colorClass}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{contribution.agentName}</span>
                      <span className="text-xs font-medium opacity-75">
                        {contribution.confidence}% confidence
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed opacity-90">
                      {contribution.contribution}
                    </p>
                    {contribution.outputCount !== undefined && (
                      <div className="mt-2 text-xs opacity-75">
                        Output: {contribution.outputCount} {contribution.outputCount === 1 ? 'item' : 'items'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}