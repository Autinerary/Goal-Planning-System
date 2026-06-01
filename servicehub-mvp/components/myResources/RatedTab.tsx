'use client'

import { useState, useEffect } from 'react'
import { Star, Edit2, Calendar, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import ResourceCard from '@/components/resources/ResourceCard'
import EmptyState from '@/components/feedback/EmptyState'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import type { Resource, Rating } from '@/types/database'

interface RatedResourceWithData extends Rating {
  resource: Resource
}

interface RatedTabProps {
  userId: string
}

type SortOption = 'date' | 'rating' | 'newest'

export default function RatedTab({ userId }: RatedTabProps) {
  const [resources, setResources] = useState<RatedResourceWithData[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortOption>('date')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchRatedResources()
  }, [userId, sort, categoryFilter])

  const fetchRatedResources = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId,
        sort,
        ...(categoryFilter && { category: categoryFilter }),
      })

      const response = await fetch(`/api/my-resources/rated?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch rated resources')
      }

      const data = await response.json()
      setResources(data.resources || [])
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching rated resources:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Rated Resources</h2>
        <p className="text-sm text-gray-600 mt-1">
          {resources.length} {resources.length === 1 ? 'resource' : 'resources'} rated
        </p>
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
              <option value="date">Date Rated</option>
              <option value="rating">Rating (Highest)</option>
              <option value="newest">Newest First</option>
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
          {resources.map((ratedResource) => {
            const resource = ratedResource.resource

            return (
              <div key={ratedResource.id} className="relative group">
                <ResourceCard
                  resource={resource}
                  averageRating={ratedResource.overall_score}
                  ratingCount={1}
                />

                {/* Actions Overlay */}
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/resources/${resource.id}/rate`}
                    className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
                    aria-label="Edit rating"
                  >
                    <Edit2 className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>

                {/* Metadata */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" aria-hidden="true" />
                      Your rating: {ratedResource.overall_score}/5
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" aria-hidden="true" />
                      Rated {new Date(ratedResource.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {ratedResource.comment && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 line-clamp-2">
                      {ratedResource.comment}
                    </div>
                  )}

                  {ratedResource.helpful_count > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <TrendingUp className="w-3 h-3" aria-hidden="true" />
                      {ratedResource.helpful_count} {ratedResource.helpful_count === 1 ? 'person' : 'people'} found this helpful
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
          <EmptyState type="rated" />
        </div>
      )}
    </div>
  )
}