'use client'

import { Info, Lightbulb, Sparkles } from 'lucide-react'

interface SynthesisExplanationProps {
  explanation: string
  resource?: any
  showDetails?: boolean
  variant?: 'default' | 'compact' | 'detailed'
}

export default function SynthesisExplanation({
  explanation,
  resource,
  showDetails = false,
  variant = 'default',
}: SynthesisExplanationProps) {
  if (variant === 'compact') {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0" aria-hidden="true" />
        <span className="text-blue-900">{explanation}</span>
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Sparkles className="w-5 h-5 text-blue-600" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 mb-2 uppercase tracking-wide">
              How we chose this
            </div>
            <p className="text-sm text-gray-800 leading-relaxed">{explanation}</p>
          </div>
        </div>

        {showDetails && resource && (
          <div className="mt-4 pt-4 border-t border-blue-200 space-y-2">
            {resource.similarUsersCount && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Similar users who rated this:</span>
                <span className="font-medium">{resource.similarUsersCount}</span>
              </div>
            )}
            {resource.score && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Match score:</span>
                <span className="font-medium">{resource.score}%</span>
              </div>
            )}
            {resource.averageRatingFromSimilarUsers && (
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Average rating from similar users:</span>
                <span className="font-medium">
                  {resource.averageRatingFromSimilarUsers.toFixed(1)}/5
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1">
          <div className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">
            How we chose this
          </div>
          <p className="text-sm text-blue-800 leading-relaxed">{explanation}</p>
        </div>
      </div>
    </div>
  )
}