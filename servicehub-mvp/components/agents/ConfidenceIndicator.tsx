'use client'

import { Sparkles } from 'lucide-react'

interface ConfidenceIndicatorProps {
  confidence: number
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
}

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (confidence >= 60) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (confidence >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  return 'bg-gray-100 text-gray-800 border-gray-200'
}

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 80) return 'Very High'
  if (confidence >= 60) return 'High'
  if (confidence >= 40) return 'Moderate'
  return 'Low'
}

export default function ConfidenceIndicator({
  confidence,
  size = 'md',
}: ConfidenceIndicatorProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} font-medium rounded-full border ${getConfidenceColor(
        confidence
      )}`}
    >
      <Sparkles className={`w-4 h-4 ${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : ''}`} aria-hidden="true" />
      <span>
        {confidence}% confidence ({getConfidenceLabel(confidence)})
      </span>
    </div>
  )
}