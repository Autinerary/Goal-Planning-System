'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import ConditionsFilter from './ConditionsFilter'
import CostFilter from './CostFilter'
import RatingChipsFilter from './RatingChipsFilter'
import { LIFE_AREAS } from '@/lib/search/lifeAreas'
import { FILTER_NORM_GROUPS } from '@/lib/norms/taxonomy'
import { SHOP_CATEGORIES, shopCategory } from '@/lib/shop/categories'

interface FilterSidebarProps {
  categories: string[]
  barriers: string[]
  conditions: string[]
  lifeAreas: string[]
  minRating?: number
  ratingStars: number[]
  minPrice?: number
  maxPrice?: number
  maxDistance?: number
  onCategoryToggle: (category: string) => void
  onBarrierToggle: (barrier: string) => void
  onLifeAreaToggle: (area: string) => void
  onConditionsChange: (next: string[]) => void
  onMinRatingChange: (rating: number | undefined) => void
  onRatingStarsChange: (next: number[]) => void
  onPriceChange: (next: { min?: number; max?: number }) => void
  onMaxDistanceChange: (distance: number | undefined) => void
  onClearFilters?: () => void
}

export default function FilterSidebar({
  categories: selectedCategories,
  barriers: selectedBarriers,
  conditions: selectedConditions,
  lifeAreas: selectedLifeAreas,
  minRating,
  ratingStars,
  minPrice,
  maxPrice,
  maxDistance,
  onCategoryToggle,
  onBarrierToggle,
  onLifeAreaToggle,
  onConditionsChange,
  onMinRatingChange,
  onRatingStarsChange,
  onPriceChange,
  onMaxDistanceChange,
  onClearFilters,
}: FilterSidebarProps) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  // Odosa: "they are working; they're just not showing up like the other ones."
  // These groups were the ONLY filters hidden behind a collapsed, single-open
  // accordion — every other section in this sidebar renders its options flat and
  // always visible. We track what's COLLAPSED rather than what's expanded, so
  // the default (empty set) shows every group open, and groups toggle
  // independently instead of closing each other.
  const [collapsedNormGroups, setCollapsedNormGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/search/categories')
      .then((res) => res.json())
      .then(setAvailableCategories)
      .catch((err) => {
        console.error('Error fetching categories:', err)
        setAvailableCategories([])
      })
  }, [])

  const toggleBarrierCategory = (category: string) => {
    setCollapsedNormGroups((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Resource Type — services/places AND shop categories (Odosa: "add the
          filters from Shop to the Resource Type filter list"). Shop items
          already appear in general results, so without these you could see a
          product in the list but had no way to filter for one.

          Grouped rather than merged into a flat list: "Books" sitting between
          "Therapist" and "School" with no distinction reads as a mistake. The
          shop rows carry their icons so they match the Shop page. */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Resource Type</h3>

        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-2">
            Services &amp; Places
          </p>
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
            <p className="text-sm text-gray-500 px-2">Loading categories...</p>
          )}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-2">
            Shop
          </p>
          {SHOP_CATEGORIES.map((c) => {
            const Icon = shopCategory(c.id).icon
            return (
              <label
                key={c.id}
                className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => onCategoryToggle(c.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Icon className="w-4 h-4 ml-2 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="ml-2 text-sm text-gray-700">{c.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Norms — barrier categories + conditions merged (Odosa). The
          "Neurodivergence" barrier is dropped; it's covered by the
          "Neurodevelopmental Conditions" group below. */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Norms</h3>
        <div className="space-y-1 border border-gray-200 rounded-lg overflow-hidden">
          {FILTER_NORM_GROUPS.map((g) => ({
              category: g.key,
              label: g.label,
              barriers: g.norms,
            }))
              .map((barrierCategory) => {
              const isExpanded = !collapsedNormGroups.has(barrierCategory.category)
              // Surfaced on the header so a collapsed group still advertises
              // that it is filtering the results.
              const selectedCount = barrierCategory.barriers.filter((b) =>
                selectedBarriers.includes(b.id)
              ).length
              return (
                <div key={barrierCategory.category} className="border-b border-gray-200 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => toggleBarrierCategory(barrierCategory.category)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <span className="text-sm font-medium text-gray-900">
                      {barrierCategory.label}
                      {selectedCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                          {selectedCount}
                        </span>
                      )}
                    </span>
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
            })}
          {/* Conditions taxonomy, merged into the same "Norms" box */}
          <ConditionsFilter embedded selected={selectedConditions} onChange={onConditionsChange} />
        </div>
      </div>

      {/* Life area — folded-in Resource Roadmap domains (Odosa). Filters
          resources by life domain. Matching is best-effort, so some domains
          may return few results until resources are tagged. */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Life Category</h3>
        <p className="text-xs text-gray-500 mb-3">
          Filter by life domain (from the Resource Roadmap).
        </p>
        <div className="space-y-2">
          {LIFE_AREAS.map((area) => (
            <label
              key={area.id}
              className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedLifeAreas.includes(area.id)}
                onChange={() => onLifeAreaToggle(area.id)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{area.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Service Ratings (chip style) */}
      <RatingChipsFilter selectedStars={ratingStars} onChange={onRatingStarsChange} />

      {/* Cost */}
      <CostFilter min={minPrice} max={maxPrice} onChange={onPriceChange} />

      {/* Rating Filter */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Minimum Overall Rating</h3>
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
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Distance From You</h3>
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
          Distances are measured from the location in your profile. Complete
          onboarding (or set a location in your profile) to sort by nearest.
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