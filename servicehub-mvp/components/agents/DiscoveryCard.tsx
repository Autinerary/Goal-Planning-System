'use client'

import { Sparkles, TrendingUp, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'
import type { DiscoveredPattern } from '@/lib/agents/pattern-agent/types'

interface DiscoveryCardProps {
  pattern: DiscoveredPattern
  highlight?: boolean
  showDetails?: boolean
}

export default function DiscoveryCard({
  pattern,
  highlight = false,
  showDetails = false,
}: DiscoveryCardProps) {
  const isRecent =
    pattern.discovered_at &&
    new Date(pattern.discovered_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        highlight || isRecent
          ? 'border-blue-300 bg-blue-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles
            className={`w-5 h-5 ${
              highlight || isRecent ? 'text-blue-600' : 'text-gray-400'
            }`}
            aria-hidden="true"
          />
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {getTypeLabel(pattern.type)}
            </div>
            {isRecent && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 mt-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                <AlertCircle className="w-3 h-3" aria-hidden="true" />
                New Discovery
              </div>
            )}
          </div>
        </div>

        {/* Confidence Badge */}
        <div
          className={`px-2 py-1 text-xs font-semibold rounded-full ${
            pattern.confidence >= 80
              ? 'bg-green-100 text-green-800'
              : pattern.confidence >= 60
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {pattern.confidence}% confidence
        </div>
      </div>

      {/* Insight */}
      <p className="text-sm text-gray-900 mb-3 leading-relaxed">{pattern.insight}</p>

      {/* Metadata */}
      {showDetails && (
        <div className="mt-4 pt-3 border-t border-gray-200 space-y-2">
          {pattern.metadata && (
            <>
              {pattern.metadata.novelty_score && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Novelty Score</span>
                  <span className="font-medium">{pattern.metadata.novelty_score}%</span>
                </div>
              )}
              {pattern.metadata.actionability_score && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Actionability</span>
                  <span className="font-medium">{pattern.metadata.actionability_score}%</span>
                </div>
              )}
              {pattern.metadata.support_count && (
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Supporting Data Points</span>
                  <span className="font-medium">{pattern.metadata.support_count}</span>
                </div>
              )}
            </>
          )}

          {pattern.discovered_at && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
              <Calendar className="w-3 h-3" aria-hidden="true" />
              <span>Discovered {new Date(pattern.discovered_at).toLocaleDateString()}</span>
            </div>
          )}

          {/* Action Links */}
          {pattern.category && (
            <Link
              href={`/search?categories=${pattern.category}`}
              className="inline-block mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View resources in {pattern.category} →
            </Link>
          )}
        </div>
      )}

      {/* Frequency Indicator */}
      {pattern.frequency > 0 && (
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
          <TrendingUp className="w-3 h-3" aria-hidden="true" />
          <span>
            Based on {pattern.frequency} {pattern.frequency === 1 ? 'user' : 'users'} data point
            {pattern.frequency === 1 ? '' : 's'}
          </span>
        </div>
      )}
    </div>
  )
}

function getTypeLabel(type: string): string {
  const labels: { [key: string]: string } = {
    barrier_combination: 'Barrier Pattern',
    resource_affinity: 'Resource Affinity',
    intersectionality: 'Intersectionality',
    non_obvious: 'Surprising Discovery',
  }
  return labels[type] || 'Pattern'
}