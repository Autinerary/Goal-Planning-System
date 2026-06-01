'use client'

import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

interface AgentDecisionProps {
  decision: ValidationAgentOutput
  showDetails?: boolean
}

const decisionConfig: {
  [key: string]: { icon: any; color: string; bgColor: string; textColor: string }
} = {
  approve: {
    icon: CheckCircle,
    color: 'green',
    bgColor: 'bg-green-50',
    textColor: 'text-green-800',
  },
  reject: {
    icon: XCircle,
    color: 'red',
    bgColor: 'bg-red-50',
    textColor: 'text-red-800',
  },
  flag_for_review: {
    icon: AlertCircle,
    color: 'yellow',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-800',
  },
}

export default function AgentDecision({
  decision,
  showDetails = false,
}: AgentDecisionProps) {
  const config = decisionConfig[decision.decision] || decisionConfig.flag_for_review
  const Icon = config.icon

  return (
    <div className={`p-4 rounded-lg border border-${config.color}-200 ${config.bgColor}`}>
      <div className="flex items-start gap-3 mb-3">
        <Icon className={`w-5 h-5 ${config.textColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className={`text-sm font-semibold ${config.textColor} uppercase tracking-wide`}>
              Agent Decision: {decision.decision.replace('_', ' ').toUpperCase()}
            </h3>
            <span className={`text-xs font-medium ${config.textColor} opacity-75`}>
              {decision.confidence}% confidence
            </span>
          </div>
          <p className={`text-sm ${config.textColor} font-medium mb-2`}>
            {decision.recommendedAction}
          </p>
        </div>
      </div>

      {decision.reasons && decision.reasons.length > 0 && (
        <div className={`mt-3 pt-3 border-t border-${config.color}-200`}>
          <div className="flex items-start gap-2 mb-2">
            <Info className={`w-4 h-4 ${config.textColor} flex-shrink-0 mt-0.5`} aria-hidden="true" />
            <div className="flex-1">
              <div className={`text-xs font-semibold ${config.textColor} mb-1`}>
                Issues Detected:
              </div>
              <ul className="space-y-1">
                {decision.reasons.map((reason, index) => (
                  <li key={index} className={`text-xs ${config.textColor} opacity-90`}>
                    • {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showDetails && decision.metadata && (
        <div className={`mt-3 pt-3 border-t border-${config.color}-200 space-y-2`}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {decision.metadata.spamScore !== undefined && (
              <div className="flex items-center justify-between">
                <span className={config.textColor + ' opacity-75'}>Spam Score:</span>
                <span className={`font-medium ${config.textColor}`}>
                  {decision.metadata.spamScore}/100
                </span>
              </div>
            )}
            {decision.metadata.contentScore !== undefined && (
              <div className="flex items-center justify-between">
                <span className={config.textColor + ' opacity-75'}>Content Score:</span>
                <span className={`font-medium ${config.textColor}`}>
                  {decision.metadata.contentScore}/100
                </span>
              </div>
            )}
            {decision.metadata.behavioralScore !== undefined && (
              <div className="flex items-center justify-between">
                <span className={config.textColor + ' opacity-75'}>Behavioral Score:</span>
                <span className={`font-medium ${config.textColor}`}>
                  {decision.metadata.behavioralScore}/100
                </span>
              </div>
            )}
            {decision.metadata.abuseLikelihood !== undefined && (
              <div className="flex items-center justify-between">
                <span className={config.textColor + ' opacity-75'}>Abuse Likelihood:</span>
                <span className={`font-medium ${config.textColor}`}>
                  {decision.metadata.abuseLikelihood}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}