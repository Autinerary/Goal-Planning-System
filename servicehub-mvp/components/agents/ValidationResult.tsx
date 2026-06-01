'use client'

import { Shield } from 'lucide-react'
import AgentDecision from './AgentDecision'
import TrustScoreBadge from './TrustScoreBadge'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

interface ValidationResultProps {
  result: ValidationAgentOutput
  showDetails?: boolean
  compact?: boolean
}

export default function ValidationResult({
  result,
  showDetails = false,
  compact = false,
}: ValidationResultProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <AgentDecision decision={result} showDetails={false} />
        <TrustScoreBadge trustScore={result.trustScore} size="sm" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-gray-900">Validation Results</h3>
        </div>
        <TrustScoreBadge trustScore={result.trustScore} size="md" />
      </div>

      <AgentDecision decision={result} showDetails={showDetails} />
    </div>
  )
}