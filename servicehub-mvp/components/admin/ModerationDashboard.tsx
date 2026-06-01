'use client'

import { useState, useEffect } from 'react'
import { Shield, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'
import AgentDecision from '@/components/agents/AgentDecision'
import TrustScoreBadge from '@/components/agents/TrustScoreBadge'
import type { ValidationAgentOutput } from '@/lib/agents/validation-agent/types'

interface ModerationItem {
  id: string
  item_type: string
  item_id: string
  submitted_by: string
  status: string
  agent_decision: string
  agent_confidence: number
  agent_reasons: string[]
  created_at: string
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  admin_override?: boolean
  item_data?: any
  user_email?: string
}

interface ModerationDashboardProps {
  userId: string
}

export default function ModerationDashboard({ userId }: ModerationDashboardProps) {
  const [items, setItems] = useState<ModerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending')
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  })

  useEffect(() => {
    fetchItems()
  }, [filter])

  const fetchItems = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: filter === 'all' ? '' : filter,
      })

      const response = await fetch(`/api/admin/moderation?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch moderation items')
      }

      const data = await response.json()
      setItems(data.items || [])
      setStats(data.stats || stats)
    } catch (error) {
      console.error('Error fetching moderation items:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (
    itemId: string,
    decision: 'approved' | 'rejected',
    notes?: string
  ) => {
    try {
      const response = await fetch(`/api/admin/moderation/${itemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes }),
      })

      if (!response.ok) {
        throw new Error('Failed to review item')
      }

      // Refresh items
      fetchItems()
    } catch (error) {
      console.error('Error reviewing item:', error)
      alert('Failed to review item. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-blue-600" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-gray-900">Moderation Dashboard</h1>
        </div>
        <p className="text-gray-600">
          Review and moderate content flagged by the validation agent
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Pending</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Approved</div>
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Rejected</div>
          <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="bg-white p-12 rounded-lg border border-gray-200 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
            <p className="text-gray-600">No items to review</p>
          </div>
        ) : (
          items.map((item) => (
            <ModerationItemCard
              key={item.id}
              item={item}
              onReview={handleReview}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ModerationItemCard({
  item,
  onReview,
}: {
  item: ModerationItem
  onReview: (id: string, decision: 'approved' | 'rejected', notes?: string) => void
}) {
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const validationOutput: ValidationAgentOutput = {
    decision: (item.agent_decision as any) || 'flag_for_review',
    confidence: item.agent_confidence || 0,
    reasons: item.agent_reasons || [],
    trustScore: 50, // Would fetch from user profile
    recommendedAction: '',
  }

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
              {item.item_type}
            </span>
            <span className="text-sm text-gray-600">
              Submitted by: {item.user_email || item.submitted_by}
            </span>
            <span className="text-sm text-gray-500">
              {new Date(item.created_at).toLocaleDateString()}
            </span>
          </div>
          {item.item_data && (
            <div className="mt-2">
              {item.item_type === 'rating' && (
                <div>
                  <div className="font-medium">{item.item_data.comment || 'No comment'}</div>
                  <div className="text-sm text-gray-600">
                    Rating: {item.item_data.overall_score}/5
                  </div>
                </div>
              )}
              {item.item_type === 'resource' && (
                <div>
                  <div className="font-medium">{item.item_data.name}</div>
                  <div className="text-sm text-gray-600">{item.item_data.category}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {item.item_data.description?.substring(0, 200)}...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <TrustScoreBadge trustScore={validationOutput.trustScore} size="sm" />
      </div>

      {/* Agent Decision */}
      <AgentDecision decision={validationOutput} showDetails={true} />

      {/* Review Actions */}
      {item.status === 'pending' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="text-sm text-blue-600 hover:text-blue-700 mb-2"
          >
            {showNotes ? 'Hide notes' : 'Add review notes'}
          </button>
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional review notes..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 text-sm"
              rows={2}
            />
          )}
          <div className="flex gap-3">
            <button
              onClick={() => onReview(item.id, 'approved', notes || undefined)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" aria-hidden="true" />
              Approve
            </button>
            <button
              onClick={() => onReview(item.id, 'rejected', notes || undefined)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <XCircle className="w-4 h-4" aria-hidden="true" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Review Status */}
      {item.status !== 'pending' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">
              Status: {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </span>
            {item.admin_override && (
              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                Admin Override
              </span>
            )}
            {item.reviewed_at && (
              <span className="text-gray-500">
                Reviewed {new Date(item.reviewed_at).toLocaleDateString()}
              </span>
            )}
          </div>
          {item.review_notes && (
            <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
              Notes: {item.review_notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}