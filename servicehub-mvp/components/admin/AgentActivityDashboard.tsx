'use client'

import { useState, useEffect } from 'react'
import { Activity, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import OrchestrationFlow from '@/components/agents/OrchestrationFlow'
import AgentActivityLog from '@/components/agents/AgentActivityLog'
import type { OrchestrationLog, AgentExecution } from '@/lib/agents/orchestrator/types'

interface AgentActivityDashboardProps {
  userId: string
}

interface AgentStats {
  totalRequests: number
  avgExecutionTime: number
  successRate: number
  agentCounts: { [agent: string]: number }
  recentActivity: OrchestrationLog[]
}

export default function AgentActivityDashboard({ userId }: AgentActivityDashboardProps) {
  const [stats, setStats] = useState<AgentStats>({
    totalRequests: 0,
    avgExecutionTime: 0,
    successRate: 0,
    agentCounts: {},
    recentActivity: [],
  })
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<OrchestrationLog | null>(null)

  useEffect(() => {
    // In a real implementation, this would fetch from a database table
    // For now, we'll create mock data structure
    loadActivityData()
  }, [])

  const loadActivityData = async () => {
    try {
      // TODO: Fetch from orchestration_logs table
      // For now, return empty stats
      setStats({
        totalRequests: 0,
        avgExecutionTime: 0,
        successRate: 100,
        agentCounts: {},
        recentActivity: [],
      })
    } catch (error) {
      console.error('Error loading activity data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Activity className="w-8 h-8 text-blue-600 animate-pulse" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-8 h-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-gray-900">Agent Activity Dashboard</h1>
        </div>
        <p className="text-gray-600">
          Monitor agent coordination, execution times, and performance metrics
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Requests</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalRequests}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-gray-400" aria-hidden="true" />
            <span className="text-sm text-gray-600">Avg Execution</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{stats.avgExecutionTime}ms</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-400" aria-hidden="true" />
            <span className="text-sm text-gray-600">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{stats.successRate}%</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Active Agents</div>
          <div className="text-2xl font-bold text-purple-600">
            {Object.keys(stats.agentCounts).length}
          </div>
        </div>
      </div>

      {/* Agent Usage Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(stats.agentCounts).map(([agent, count]) => (
            <div key={agent} className="text-center">
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-sm text-gray-600">{agent}</div>
            </div>
          ))}
        </div>
        {Object.keys(stats.agentCounts).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" aria-hidden="true" />
            <p>No agent activity yet</p>
          </div>
        )}
      </div>

      {/* Orchestration Flow Visualization */}
      {selectedLog && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Orchestration Flow</h2>
          <OrchestrationFlow log={selectedLog} />
        </div>
      )}

      {/* Activity Log */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <AgentActivityLog
          logs={stats.recentActivity}
          onLogSelect={setSelectedLog}
          selectedLog={selectedLog}
        />
      </div>
    </div>
  )
}