'use client'

import { useState } from 'react'
import { Clock, CheckCircle, XCircle, Eye } from 'lucide-react'
import type { OrchestrationLog } from '@/lib/agents/orchestrator/types'

interface AgentActivityLogProps {
  logs: OrchestrationLog[]
  onLogSelect?: (log: OrchestrationLog) => void
  selectedLog?: OrchestrationLog | null
}

export default function AgentActivityLog({
  logs,
  onLogSelect,
  selectedLog,
}: AgentActivityLogProps) {
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all')

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true
    if (filter === 'success') {
      return log.executions?.every((e) => e.success) ?? true
    }
    if (filter === 'error') {
      return log.executions?.some((e) => !e.success) ?? false
    }
    return true
  })

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
        <p>No activity logs yet</p>
        <p className="text-sm mt-2">Agent activity will appear here once requests are processed</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'success', 'error'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Log List */}
      <div className="space-y-3">
        {filteredLogs.map((log) => {
          const allSuccess = log.executions?.every((e) => e.success) ?? true
          const isSelected = selectedLog?.requestId === log.requestId

          return (
            <div
              key={log.requestId}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : allSuccess
                  ? 'border-gray-200 bg-white hover:border-gray-300'
                  : 'border-red-200 bg-red-50 hover:border-red-300'
              }`}
              onClick={() => onLogSelect?.(log)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {allSuccess ? (
                      <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                    )}
                    <span className="font-semibold text-gray-900 capitalize">
                      {log.requestType.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">#{log.requestId.slice(0, 8)}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {log.agentsInvolved.length > 0
                      ? `Agents: ${log.agentsInvolved.join(', ')}`
                      : 'No agents involved'}
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    <span>{log.duration ? `${log.duration}ms` : 'N/A'}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {log.startTime ? new Date(log.startTime).toLocaleTimeString() : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Agent Executions Summary */}
              {log.executions && log.executions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {log.executions.map((execution) => (
                      <div
                        key={execution.agentName}
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          execution.success
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {execution.agentName}: {execution.duration ? `${execution.duration}ms` : 'N/A'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* View Details Button */}
              <div className="mt-3 flex justify-end">
                <button
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    onLogSelect?.(log)
                  }}
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  View Details
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}