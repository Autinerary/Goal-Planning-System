'use client'

import { useState, useEffect } from 'react'
import { Star, Trash2, MapPin, Calendar, FileDown, Share2, Plus } from 'lucide-react'
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

interface SavedTabProps {
  userId: string
}

type SortOption = 'date' | 'rating' | 'distance'
type FilterOption = string | null

export default function SavedTab({ userId }: SavedTabProps) {
  const [resources, setResources] = useState<SavedResourceWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('date')
  const [categoryFilter, setCategoryFilter] = useState<FilterOption>(null)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchSavedResources()
  }, [userId, sort, categoryFilter])

  const fetchSavedResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId,
        sort,
        ...(categoryFilter && { category: categoryFilter }),
      })

      const response = await fetch(`/api/my-resources/saved?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch saved resources')
      }

      const data = await response.json()
      setResources(data.resources || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching saved resources:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCurrent = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/my-resources/saved/${resourceId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'current' }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      showToast.success('Added to Current Resources')
      setResources((prev) => prev.filter((r) => r.resource_id !== resourceId))
    } catch (error) {
      console.error('Error updating status:', error)
      showToast.error('Failed to update status. Please try again.')
    }
  }

  const handleRemoveSaved = async (resourceId: string) => {
    try {
      const response = await fetch(`/api/resources/${resourceId}/save`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setResources((prev) => prev.filter((r) => r.resource_id !== resourceId))
      }
      if (!response.ok) {
        throw new Error('Failed to remove saved resource')
      }
      showToast.success('Resource removed from saved list')
      setResources((prev) => prev.filter((r) => r.resource_id !== resourceId))
    } catch (error) {
      console.error('Error removing saved resource:', error)
      showToast.error('Failed to remove saved resource. Please try again.')
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

      // Update local state
      setResources((prev) =>
        prev.map((r) => (r.resource_id === resourceId ? { ...r, notes: note } : r))
      )
    } catch (error) {
      console.error('Error saving note:', error)
      throw error
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

      // Update local state
      setResources((prev) =>
        prev.map((r) => (r.resource_id === resourceId ? { ...r, notes: null } : r))
      )
    } catch (error) {
      console.error('Error deleting note:', error)
      throw error
    }
  }

  const handleExportJSON = () => {
    const data = resources.map((r) => ({
      name: r.resource.name,
      category: r.resource.category,
      location: r.resource.location,
      savedDate: r.created_at,
      note: r.notes,
    }))

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `saved-resources-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'City', 'Province', 'Saved Date', 'Note']
    const rows = resources.map((r) => {
      const location = r.resource.location as any
      return [
        r.resource.name,
        r.resource.category,
        location?.city || '',
        location?.province || '',
        new Date(r.created_at).toLocaleDateString(),
        r.notes || '',
      ]
    })

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `saved-resources-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Saved Resources</h2>
          <p className="text-sm text-gray-600 mt-1">
            {resources.length} {resources.length === 1 ? 'resource' : 'resources'} saved
          </p>
        </div>

        {resources.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              Export JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Filters and Sort */}
      {resources.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Sort by:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date Saved</option>
              <option value="rating">Rating</option>
              <option value="distance">Distance</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by category:</label>
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
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
          {resources.map((savedResource) => {
            const resource = savedResource.resource
            const location = resource.location as any

            return (
              <div key={savedResource.id} className="relative group">
                <ResourceCard
                  resource={resource}
                  averageRating={savedResource.averageRating || 0}
                  ratingCount={savedResource.ratingCount || 0}
                />

                {/* Actions Overlay */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRemoveSaved(resource.id)}
                    className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-lg"
                    aria-label="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Metadata and Notes */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      Saved {new Date(savedResource.created_at).toLocaleDateString()}
                    </div>
                    {location?.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" aria-hidden="true" />
                        {location.city}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="mt-2">
                    <ResourceNote
                      resourceId={resource.id}
                      initialNote={savedResource.notes || undefined}
                      onSave={handleSaveNote}
                      onDelete={handleDeleteNote}
                    />
                  </div>

                  {/* Add to Current Button */}
                  <button
                    onClick={() => handleAddToCurrent(resource.id)}
                    className="w-full mt-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-3 h-3" />
                    Add to Current
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <EmptyState type="saved" />
        </div>
      )}
    </div>
  )
}