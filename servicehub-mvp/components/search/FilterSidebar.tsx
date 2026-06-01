'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

interface BarrierCategory {
  category: string
  label: string
  barriers: { id: string; label: string }[]
}

interface FilterSidebarProps {
  categories: string[]
  barriers: string[]
  minRating?: number
  maxDistance?: number
  onCategoryToggle: (category: string) => void
  onBarrierToggle: (barrier: string) => void
  onMinRatingChange: (rating: number | undefined) => void
  onMaxDistanceChange: (distance: number | undefined) => void
  onClearFilters?: () => void
}

export default function FilterSidebar({
  categories: selectedCategories,
  barriers: selectedBarriers,
  minRating,
  maxDistance,
  onCategoryToggle,
  onBarrierToggle,
  onMinRatingChange,
  onMaxDistanceChange,
  onClearFilters,
}: FilterSidebarProps) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [barrierCategories, setBarrierCategories] = useState<BarrierCategory[]>([])
  const [barriersLoading, setBarriersLoading] = useState(true)
  const [expandedBarrierCategory, setExpandedBarrierCategory] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/search/categories')
      .then((res) => res.json())
      .then(setAvailableCategories)
      .catch((err) => {
        console.error('Error fetching categories:', err)
        setAvailableCategories([])
      })

    setBarriersLoading(true)
    fetch('/api/search/barriers')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBarrierCategories(data)
        } else {
          console.error('Barriers API returned non-array:', data)
          setBarrierCategories([])
        }
      })
      .catch((err) => {
        console.error('Error fetching barriers:', err)
        setBarrierCategories([])
      })
      .finally(() => {
        setBarriersLoading(false)
      })
  }, [])

  const toggleBarrierCategory = (category: string) => {
    setExpandedBarrierCategory(expandedBarrierCategory === category ? null : category)
  }

  return (
    <div className="space-y-6">
      {/* Categories */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Category</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {availableCategories.length > 0 ? (
            availableCategories.map((category) => (
              <label
                key={category}
                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => onCategoryToggle(category)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700 capitalize">{category}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-gray-500">Loading categories...</p>
          )}
        </div>
      </div>

      {/* Systematic Barrier Filter (Accordion) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Barriers</h3>
        <div className="space-y-1 border border-gray-200 rounded-lg overflow-hidden">
          {barriersLoading ? (
            <p className="px-4 py-3 text-sm text-gray-500">Loading barriers...</p>
          ) : barrierCategories.length > 0 ? (
            barrierCategories.map((barrierCategory) => {
              const isExpanded = expandedBarrierCategory === barrierCategory.category
              return (
                <div key={barrierCategory.category} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleBarrierCategory(barrierCategory.category)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-sm font-medium text-gray-900">{barrierCategory.label}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 bg-gray-50 space-y-1 max-h-64 overflow-y-auto">
                      {barrierCategory.barriers.map((barrier) => (
                        <label
                          key={barrier.id}
                          className="flex items-center cursor-pointer hover:bg-white p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedBarriers.includes(barrier.id)}
                            onChange={() => onBarrierToggle(barrier.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{barrier.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <p className="px-4 py-3 text-sm text-gray-500">No barriers available. Complete onboarding to add barriers.</p>
          )}
        </div>
      </div>

      {/* Rating Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Minimum Rating</h3>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <label
              key={rating}
              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="radio"
                name="rating"
                checked={minRating === rating}
                onChange={() => onMinRatingChange(minRating === rating ? undefined : rating)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                {rating}+ stars
                {rating === 5 && (
                  <span className="ml-1 text-xs text-gray-500">(Excellent)</span>
                )}
              </span>
            </label>
          ))}
          <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="radio"
              name="rating"
              checked={minRating === undefined}
              onChange={() => onMinRatingChange(undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Any rating</span>
          </label>
        </div>
      </div>

      {/* Distance Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Maximum Distance</h3>
        <div className="space-y-2">
          {[5, 10, 25, 50, 100].map((distance) => (
            <label
              key={distance}
              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="radio"
                name="distance"
                checked={maxDistance === distance}
                onChange={() => onMaxDistanceChange(maxDistance === distance ? undefined : distance)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Within {distance} km
                {distance === 5 && <span className="ml-1 text-xs text-gray-500">(Nearby)</span>}
              </span>
            </label>
          ))}
          <label className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="radio"
              name="distance"
              checked={maxDistance === undefined}
              onChange={() => onMaxDistanceChange(undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Any distance</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Note: Location filtering requires your location to be set in your profile.
        </p>
      </div>

      {/* Clear Filters */}
      {onClearFilters && (
        <div>
          <button
            onClick={onClearFilters}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  )
}