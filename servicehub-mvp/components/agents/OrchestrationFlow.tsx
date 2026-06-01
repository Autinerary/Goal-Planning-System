'use client'

import { ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { OrchestrationLog, AgentExecution } from '@/lib/agents/orchestrator/types'

interface OrchestrationFlowProps {
  log: OrchestrationLog
}

export default function OrchestrationFlow({ log }: OrchestrationFlowProps) {
  const executions = log.executions || []

  return (
    <div className="space-y-4">
      {/* Flow Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-sm text-gray-600">Request Type</div>
          <div className="text-lg font-semibold text-gray-900 capitalize">
            {log.requestType.replace('_', ' ')}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Total Duration</div>
          <div className="text-lg font-semibold text-blue-600">
            {log.duration ? `${log.duration}ms` : 'N/A'}
          </div>
        </div>
      </div>

      {/* Agent Flow */}
      <div className="flex items-center gap-4 overflow-x-auto pb-4">
        {executions.map((execution, index) => (
          <div key={execution.agentName} className="flex items-center gap-4 flex-shrink-0">
            {/* Agent Node */}
            <div className="relative">
              <div
                className={`flex flex-col items-center p-4 rounded-lg border-2 min-w-[140px] ${
                  execution.success
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {/* Agent Icon */}
                <div className="mb-2">
                  {execution.success ? (
                    <CheckCircle className="w-8 h-8 text-green-600" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-8 h-8 text-red-600" aria-hidden="true" />
                  )}
                </div>

                {/* Agent Name */}
                <div className="text-sm font-semibold text-gray-900 mb-1">
                  {execution.agentName}
                </div>

                {/* Execution Time */}
                {execution.duration && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{execution.duration}ms</span>
                  </div>
                )}

                {/* Error Message */}
                {execution.error && (
                  <div className="mt-2 text-xs text-red-600 text-center max-w-[120px] truncate">
                    {execution.error}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow (if not last) */}
            {index < executions.length - 1 && (
              <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
        ))}

        {executions.length === 0 && (
          <div className="text-center py-8 text-gray-500 w-full">
            <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p>No agent executions recorded</p>
          </div>
        )}
      </div>

      {/* Execution Timeline */}
      {executions.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Execution Timeline</h3>
          <div className="space-y-2">
            {executions.map((execution) => (
              <div
                key={execution.agentName}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      execution.success ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="font-medium text-gray-900">{execution.agentName}</span>
                </div>
                <div className="text-gray-600">
                  {execution.duration ? `${execution.duration}ms` : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conflicts */}
      {log.conflicts && log.conflicts.length > 0 && (
        <div className="mt-6 pt-6 border-t border-red-200">
          <h3 className="text-sm font-semibold text-red-900 mb-3">Agent Conflicts</h3>
          <div className="space-y-2">
            {log.conflicts.map((conflict, index) => (
              <div
                key={index}
                className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm"
              >
                <div className="font-medium text-red-900 mb-1">
                  {conflict.agent1} vs {conflict.agent2}
                </div>
                <div className="text-red-700">{conflict.description}</div>
                <div className="mt-2 text-xs text-red-600">
                  Resolution: {conflict.resolution}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}