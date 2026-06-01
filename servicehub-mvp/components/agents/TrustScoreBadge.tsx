'use client'

import { Shield, TrendingUp, TrendingDown } from 'lucide-react'
import type { TrustScoreResult } from '@/lib/agents/validation-agent/types'

interface TrustScoreBadgeProps {
  trustScore: number
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
}

const sizeClasses = {
  sm: 'text-xs px-2 py-1',
  md: 'text-sm px-3 py-1.5',
  lg: 'text-base px-4 py-2',
}

const getTrustColor = (trustScore: number): string => {
  if (trustScore >= 80) return 'bg-green-100 text-green-800 border-green-200'
  if (trustScore >= 60) return 'bg-blue-100 text-blue-800 border-blue-200'
  if (trustScore >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  return 'bg-red-100 text-red-800 border-red-200'
}

const getTrustLabel = (trustScore: number): string => {
  if (trustScore >= 80) return 'High Trust'
  if (trustScore >= 60) return 'Medium Trust'
  if (trustScore >= 40) return 'Low Trust'
  return 'Untrusted'
}

export default function TrustScoreBadge({
  trustScore,
  size = 'md',
  showDetails = false,
}: TrustScoreBadgeProps) {
  const Icon = trustScore >= 60 ? TrendingUp : TrendingDown

  return (
    <div
      className={`inline-flex items-center gap-2 ${sizeClasses[size]} font-medium rounded-full border ${getTrustColor(
        trustScore
      )}`}
    >
      <Shield className={`w-4 h-4 ${size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : ''}`} aria-hidden="true" />
      <span>
        {trustScore}/100 ({getTrustLabel(trustScore)})
      </span>
      {showDetails && (
        <Icon
          className={`w-3 h-3 ${size === 'lg' ? 'w-4 h-4' : ''}`}
          aria-hidden="true"
        />
      )}
    </div>
  )
}