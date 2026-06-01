'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle, XCircle, Eye, Edit2 } from 'lucide-react'
import Link from 'next/link'
import ResourceCard from '@/components/resources/ResourceCard'
import EmptyState from '@/components/feedback/EmptyState'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import type { Resource } from '@/types/database'

interface SubmittedTabProps {
  userId: string
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected'

export default function SubmittedTab({ userId }: SubmittedTabProps) {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    fetchSubmittedResources()
  }, [userId, statusFilter])

  const fetchSubmittedResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      })

      const response = await fetch(`/api/my-resources/submitted?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch submitted resources')
      }

      const data = await response.json()
      setResources(data.resources || [])
    } catch (error) {
      console.error('Error fetching submitted resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: Resource['status']) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" aria-hidden="true" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" aria-hidden="true" />
      case 'pending':
      default:
        return <Clock className="w-4 h-4 text-yellow-600" aria-hidden="true" />
    }
  }

  const getStatusLabel = (status: Resource['status']) => {
    switch (status) {
      case 'approved':
        return 'Approved'
      case 'rejected':
        return 'Rejected'
      case 'pending':
      default:
        return 'Pending Review'
    }
  }

  const getStatusColor = (status: Resource['status']) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Submitted Resources</h2>
        <p className="text-sm text-gray-600 mt-1">
          {resources.length} {resources.length === 1 ? 'resource' : 'resources'} submitted
        </p>
      </div>

      {/* Status Filter */}
      {resources.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="text-sm font-medium text-gray-700">Filter by status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      )}

      {/* Resources List */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      ) : resources.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource) => (
            <div key={resource.id} className="relative group">
              <ResourceCard resource={resource} />

              {/* Status Badge */}
              <div className="absolute top-4 left-4">
                <div
                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(
                    resource.status
                  )}`}
                >
                  {getStatusIcon(resource.status)}
                  {getStatusLabel(resource.status)}
                </div>
              </div>

              {/* Actions Overlay */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/resources/${resource.id}`}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
                  aria-label="View resource"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>

              {/* Metadata */}
              <div className="mt-3 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  Submitted {new Date(resource.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <EmptyState type="submitted" />
        </div>
      )}
    </div>
  )
}