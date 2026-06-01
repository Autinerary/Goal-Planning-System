'use client'

import { useState, useEffect } from 'react'
import { Star, Trash2, Calendar, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import ResourceCard from '@/components/resources/ResourceCard'
import ResourceNote from './ResourceNote'
import EmptyState from '@/components/feedback/EmptyState'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import { showToast } from '@/lib/toast'
import type { Resource, SavedResource } from '@/types/database'

interface SavedResourceWithData extends SavedResource {
  resource: Resource
  averageRating?: number
  ratingCount?: number
}

interface PastTabProps {
  userId: string
}

type SortOption = 'date' | 'rating' | 'distance'
type FilterOption = string | null

export default function PastTab({ userId }: PastTabProps) {
  const [resources, setResources] = useState<SavedResourceWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('date')
  const [categoryFilter, setCategoryFilter] = useState<FilterOption>(null)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchPastResources()
  }, [userId, sort, categoryFilter])

  const fetchPastResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId,
        status: 'past',
        sort,
        ...(categoryFilter && { category: categoryFilter }),
      })

      const response = await fetch(`/api/my-resources/saved?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch past resources')
      }

      const data = await response.json()
      setResources(data.resources || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching past resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMoveToCurrent = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/my-resources/saved/${resourceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'current' }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      showToast.success('Moved to Current Resources')
      setResources((prev) => prev.filter((r) => r.resource_id !== resourceId))
    } catch (error) {
      console.error('Error updating status:', error)
      showToast.error('Failed to update status. Please try again.')
    }
  }

  const handleRemove = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/resources/${resourceId}/save`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove resource')
      }

      showToast.success('Resource removed')
      setResources((prev) => prev.filter((r) => r.resource_id !== resourceId))
    } catch (error) {
      console.error('Error removing resource:', error)
      showToast.error('Failed to remove resource. Please try again.')
    }
  }

  const handleDeleteNote = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/my-resources/saved/${resourceId}/note`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete note')
      }

      showToast.success('Note deleted')
      setResources((prev) =>
        prev.map((r) =>
          r.resource_id === resourceId ? { ...r, notes: null } : r
        )
      )
    } catch (error) {
      console.error('Error deleting note:', error)
      showToast.error('Failed to delete note. Please try again.')
    }
  }

  const handleSaveNote = async (resourceId: string, note: string) => {
    try {
      const response = await fetch(`/api/my-resources/saved/${resourceId}/note`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      })

      if (!response.ok) {
        throw new Error('Failed to save note')
      }

      setResources((prev) =>
        prev.map((r) => (r.resource_id === resourceId ? { ...r, notes: note } : r))
      )
    } catch (error) {
      console.error('Error saving note:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <ResourceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <EmptyState
        title="No Past Resources"
        message="Resources you've used in the past will appear here."
        actionLabel="Browse Resources"
        actionHref="/search"
        icon={<Calendar className="w-12 h-12 text-gray-400" />}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.length > 0 && (
            <>
              <button
                onClick={() => setCategoryFilter(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  categoryFilter === null
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Categories
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                    categoryFilter === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </>
          )}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="date">Sort by Date</option>
          <option value="rating">Sort by Rating</option>
          <option value="distance">Sort by Distance</option>
        </select>
      </div>

      {/* Resources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {resources.map((savedResource) => {
          const resource = savedResource.resource
          return (
            <div key={savedResource.id} className="relative">
              <ResourceCard
                resource={resource}
                averageRating={savedResource.averageRating || 0}
                ratingCount={savedResource.ratingCount || 0}
                variant="grid"
              />

              {/* Actions and Notes */}
              <div className="mt-4 space-y-3">
                {/* Notes */}
                <ResourceNote
                  resourceId={savedResource.resource_id}
                  initialNote={savedResource.notes || ''}
                  onSave={handleSaveNote}
                  onDelete={handleDeleteNote}
                />

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMoveToCurrent(savedResource.resource_id)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Move to Current
                  </button>
                  <button
                    onClick={() => handleRemove(savedResource.resource_id)}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                    aria-label="Remove resource"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
