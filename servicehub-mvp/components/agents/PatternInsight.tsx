'use client'

import { Lightbulb, TrendingUp, Users, Sparkles } from 'lucide-react'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

interface PatternInsightProps {
  pattern: DiscoveredPattern
  variant?: 'default' | 'compact' | 'detailed'
}

const typeColors: { [key: string]: string } = {
  barrier_combination: 'bg-purple-50 border-purple-200 text-purple-800',
  resource_affinity: 'bg-blue-50 border-blue-200 text-blue-800',
  intersectionality: 'bg-green-50 border-green-200 text-green-800',
  non_obvious: 'bg-yellow-50 border-yellow-200 text-yellow-800',
}

const typeIcons: { [key: string]: any } = {
  barrier_combination: Users,
  resource_affinity: TrendingUp,
  intersectionality: Sparkles,
  non_obvious: Lightbulb,
}

const typeLabels: { [key: string]: string } = {
  barrier_combination: 'Barrier Pattern',
  resource_affinity: 'Resource Affinity',
  intersectionality: 'Intersectionality',
  non_obvious: 'Surprising Discovery',
}

export default function PatternInsight({ pattern, variant = 'default' }: PatternInsightProps) {
  const Icon = typeIcons[pattern.type] || Lightbulb
  const colorClass = typeColors[pattern.type] || 'bg-gray-50 border-gray-200 text-gray-800'

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${colorClass}`}>
        <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span className="font-medium">{pattern.insight}</span>
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={`p-4 rounded-lg border ${colorClass}`}>
        <div className="flex items-start gap-3 mb-3">
          <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-75">
                {typeLabels[pattern.type]}
              </span>
              <span className="text-xs font-medium opacity-75">{pattern.confidence}% confidence</span>
            </div>
            <p className="text-sm font-medium mb-2">{pattern.insight}</p>
            {pattern.metadata && (
              <div className="flex items-center gap-4 text-xs opacity-75 mt-3">
                {pattern.frequency > 0 && (
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" aria-hidden="true" />
                    <span>{pattern.frequency} {pattern.frequency === 1 ? 'user' : 'users'}</span>
                  </div>
                )}
                {pattern.metadata.novelty_score && (
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    <span>Novelty: {pattern.metadata.novelty_score}%</span>
                  </div>
                )}
                {pattern.metadata.actionability_score && (
                  <div className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" aria-hidden="true" />
                    <span>Actionable: {pattern.metadata.actionability_score}%</span>
                  </div>
                )}
              </div>
            )}
            {pattern.discovered_at && (
              <div className="text-xs opacity-60 mt-2">
                Discovered {new Date(pattern.discovered_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <div className={`p-3 rounded-lg border ${colorClass}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed">{pattern.insight}</p>
          <div className="flex items-center gap-3 mt-2 text-xs opacity-75">
            <span>{pattern.confidence}% confidence</span>
            {pattern.frequency > 0 && (
              <>
                <span>•</span>
                <span>{pattern.frequency} {pattern.frequency === 1 ? 'user' : 'users'}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}