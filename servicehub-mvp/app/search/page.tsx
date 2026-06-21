'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ResourceCard from '@/components/resources/ResourceCard'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import FilterSidebar from '@/components/search/FilterSidebar'
import SearchBar from '@/components/search/SearchBar'
import SortMultiSelect, { type SortRule as UiSortRule, type SortKey } from '@/components/search/SortMultiSelect'
import ViewToggle from '@/components/search/ViewToggle'
import Pagination from '@/components/search/Pagination'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { findCondition, decodeCondition } from '@/lib/search/conditions'
import { Search, Filter, X } from 'lucide-react'
import type { SearchResult } from '@/lib/supabase/queries'

const RESULT_COUNT_PER_PAGE = 20

const VALID_SORT_KEYS = new Set<SortKey>([
  'relevance',
  'rating',
  'reviews',
  'newest',
  'distance',
  'cost',
])

function encodeSortRules(rules: UiSortRule[]): string {
  if (rules.length === 0) return ''
  return rules.map((r) => `${r.key}:${r.direction}`).join(',')
}

function decodeSortRules(raw: string | null): UiSortRule[] {
  if (!raw) return []
  // Single-key legacy form: ?sort=rating
  if (!raw.includes(',') && !raw.includes(':')) {
    return VALID_SORT_KEYS.has(raw as SortKey)
      ? [{ key: raw as SortKey, direction: raw === 'cost' ? 'asc' : 'desc' }]
      : []
  }
  const out: UiSortRule[] = []
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim()
    if (!trimmed) continue
    const [keyRaw, dirRaw] = trimmed.split(':')
    const key = keyRaw?.trim() as SortKey
    if (!VALID_SORT_KEYS.has(key)) continue
    const direction = dirRaw?.trim() === 'asc' ? 'asc' : 'desc'
    out.push({ key, direction })
  }
  return out
}

function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [results, setResults] = useState<SearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; type?: string } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Extract filters from URL
  const query = searchParams.get('q') || ''
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) || []
  const barriers = searchParams.get('barriers')?.split(',').filter(Boolean) || []
  const conditions = searchParams.get('conditions')?.split(',').filter(Boolean) || []
  const ratingStarsRaw = searchParams.get('ratingStars')?.split(',').filter(Boolean) || []
  const ratingStars = ratingStarsRaw.map((s) => Number(s)).filter((n) => !Number.isNaN(n))
  const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
  const maxDistance = searchParams.get('maxDistance') ? Number(searchParams.get('maxDistance')) : undefined
  const sortRules = decodeSortRules(searchParams.get('sort'))
  const sortParam =
    sortRules.length === 0
      ? 'relevance'
      : sortRules.length === 1
      ? `${sortRules[0].key}:${sortRules[0].direction}`
      : encodeSortRules(sortRules)
  const page = Number(searchParams.get('page') || '1')

  // Update URL params
  const updateSearchParams = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const params = new URLSearchParams(searchParams.toString())
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          params.delete(key)
        } else if (Array.isArray(value)) {
          params.set(key, value.join(','))
        } else {
          params.set(key, value)
        }
      })

      // Reset to page 1 when filters change (unless page is explicitly set)
      if (!('page' in updates)) {
        params.delete('page')
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [searchParams, router, pathname]
  )

  // Fetch search results
  useEffect(() => {
    async function fetchResults() {
      setLoading(true)
      setError(null)
      try {
        const apiParams = new URLSearchParams({
          q: query,
          categories: categories.join(','),
          barriers: barriers.join(','),
          conditions: conditions.join(','),
          ratingStars: ratingStars.join(','),
          minRating: minRating?.toString() || '',
          minPrice: minPrice?.toString() || '',
          maxPrice: maxPrice?.toString() || '',
          maxDistance: maxDistance?.toString() || '',
          sort: sortParam,
          page: page.toString(),
          pageSize: RESULT_COUNT_PER_PAGE.toString(),
        })
        const response = await fetch(`/api/search?${apiParams.toString()}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch search results')
        }

        const data = await response.json()
        setResults(data.results || [])
        setTotal(data.total || 0)
        setError(null)
      } catch (error) {
        console.error('Error fetching search results:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch search results'
        const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network')
        setError({
          message: errorMessage,
          type: isNetworkError ? 'network' : 'server',
        })
        setResults([])
        setTotal(0)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [
    query,
    categories.join(','),
    barriers.join(','),
    conditions.join(','),
    ratingStars.join(','),
    minRating,
    minPrice,
    maxPrice,
    maxDistance,
    sortParam,
    page,
  ])

  const handleQueryChange = useCallback(
    (newQuery: string) => {
      updateSearchParams({ q: newQuery })
    },
    [updateSearchParams]
  )

  const handleCategoryToggle = useCallback(
    (category: string) => {
      const newCategories = categories.includes(category)
        ? categories.filter((c) => c !== category)
        : [...categories, category]
      updateSearchParams({ categories: newCategories })
    },
    [categories, updateSearchParams]
  )

  const handleBarrierToggle = useCallback(
    (barrier: string) => {
      const newBarriers = barriers.includes(barrier)
        ? barriers.filter((b) => b !== barrier)
        : [...barriers, barrier]
      updateSearchParams({ barriers: newBarriers })
    },
    [barriers, updateSearchParams]
  )

  const handleConditionsChange = useCallback(
    (next: string[]) => {
      updateSearchParams({ conditions: next })
    },
    [updateSearchParams]
  )

  const handleRatingStarsChange = useCallback(
    (next: number[]) => {
      updateSearchParams({ ratingStars: next.map((n) => n.toString()) })
    },
    [updateSearchParams]
  )

  const handlePriceChange = useCallback(
    (next: { min?: number; max?: number }) => {
      updateSearchParams({
        minPrice: next.min !== undefined ? next.min.toString() : undefined,
        maxPrice: next.max !== undefined ? next.max.toString() : undefined,
      })
    },
    [updateSearchParams]
  )

  const handleMinRatingChange = useCallback(
    (rating: number | undefined) => {
      updateSearchParams({ minRating: rating?.toString() })
    },
    [updateSearchParams]
  )

  const handleMaxDistanceChange = useCallback(
    (distance: number | undefined) => {
      updateSearchParams({ maxDistance: distance?.toString() })
    },
    [updateSearchParams]
  )

  const handleSortChange = useCallback(
    (rules: UiSortRule[]) => {
      updateSearchParams({ sort: rules.length === 0 ? undefined : encodeSortRules(rules) })
    },
    [updateSearchParams]
  )

  const handlePageChange = useCallback(
    (newPage: number) => {
      updateSearchParams({ page: newPage.toString() })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [updateSearchParams]
  )

  const clearFilters = useCallback(() => {
    updateSearchParams({
      q: '',
      categories: undefined,
      barriers: undefined,
      conditions: undefined,
      ratingStars: undefined,
      minRating: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      maxDistance: undefined,
      sort: 'relevance',
    })
  }, [updateSearchParams])

  const hasActiveFilters =
    categories.length > 0 ||
    barriers.length > 0 ||
    conditions.length > 0 ||
    ratingStars.length > 0 ||
    minRating !== undefined ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    maxDistance !== undefined

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Search Header */}
          <div className="mb-6">
            <SearchBar
              query={query}
              onQueryChange={handleQueryChange}
              placeholder="Search for resources..."
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Filter Sidebar (Desktop) */}
            <aside className="hidden lg:block lg:w-64">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

                <FilterSidebar
                  categories={categories}
                  barriers={barriers}
                  conditions={conditions}
                  minRating={minRating}
                  ratingStars={ratingStars}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  maxDistance={maxDistance}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onConditionsChange={handleConditionsChange}
                  onMinRatingChange={handleMinRatingChange}
                  onRatingStarsChange={handleRatingStarsChange}
                  onPriceChange={handlePriceChange}
                  onMaxDistanceChange={handleMaxDistanceChange}
                  onClearFilters={hasActiveFilters ? clearFilters : undefined}
                />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setShowFilters(true)}
                      className="lg:hidden flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Show filters"
                    >
                      <Filter className="w-4 h-4" />
                      Filters
                      {hasActiveFilters && (
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {categories.length +
                            barriers.length +
                            conditions.length +
                            (ratingStars.length > 0 ? 1 : 0) +
                            (minRating ? 1 : 0) +
                            (minPrice !== undefined || maxPrice !== undefined ? 1 : 0) +
                            (maxDistance ? 1 : 0)}
                        </span>
                      )}
                    </button>

                    <div className="text-sm text-gray-600">
                      {loading ? (
                        'Searching...'
                      ) : (
                        <>
                          {total > 0 ? (
                            <>
                              Showing {(page - 1) * RESULT_COUNT_PER_PAGE + 1}-
                              {Math.min(page * RESULT_COUNT_PER_PAGE, total)} of {total} results
                            </>
                          ) : (
                            'No results found'
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <SortMultiSelect value={sortRules} onChange={handleSortChange} />
                    <ViewToggle value={viewMode} onChange={setViewMode} />
                  </div>
                </div>

                {/* Active Filter Chips */}
                {hasActiveFilters && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => handleCategoryToggle(category)}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {category}
                        <X className="w-3 h-3" />
                      </button>
                    ))}
                    {conditions.map((token) => {
                      const { id, sub } = decodeCondition(token)
                      const option = findCondition(id)
                      const subOption = option?.subOptions?.find((s) => s.id === sub)
                      const label = option
                        ? subOption
                          ? `${option.label}: ${subOption.label}`
                          : option.label
                        : token
                      return (
                        <button
                          key={`cond-${token}`}
                          onClick={() => handleConditionsChange(conditions.filter((t) => t !== token))}
                          className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {label}
                          <X className="w-3 h-3" />
                        </button>
                      )
                    })}
                    {(minPrice !== undefined || maxPrice !== undefined) && (
                      <button
                        onClick={() => handlePriceChange({ min: undefined, max: undefined })}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Cost: ${minPrice ?? 0} – ${maxPrice ?? '∞'}
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {ratingStars.length > 0 && (
                      <button
                        onClick={() => handleRatingStarsChange([])}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Math.min(...ratingStars)}+ stars
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {minRating && (
                      <button
                        onClick={() => handleMinRatingChange(undefined)}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Rating: {minRating}+ stars
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {maxDistance && (
                      <button
                        onClick={() => handleMaxDistanceChange(undefined)}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        Within {maxDistance} km
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Error State */}
              {error && !loading && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <ErrorState
                    title={error.type === 'network' ? 'Connection Error' : 'Error Loading Results'}
                    message={error.message}
                    errorType={error.type as any}
                    onRetry={() => {
                      setError(null)
                      // Trigger refetch by updating a dependency
                      const params = new URLSearchParams(searchParams.toString())
                      router.push(`${pathname}?${params.toString()}`)
                    }}
                    showRetry={true}
                  />
                </div>
              )}

              {/* Results */}
              {!error && loading ? (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
                      : 'space-y-4'
                  }
                >
                  {[...Array(6)].map((_, i) => (
                    <ResourceCardSkeleton key={i} />
                  ))}
                </div>
              ) : !error && results.length > 0 ? (
                <>
                  <div
                    className={
                      viewMode === 'grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'
                        : 'space-y-4 mb-8'
                    }
                  >
                    {results.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        averageRating={resource.averageRating}
                        ratingCount={resource.ratingCount}
                        distance={resource.distance}
                        showBadges={true}
                        variant={viewMode}
                      />
                    ))}
                  </div>

                  <Pagination
                    currentPage={page}
                    totalResults={total}
                    pageSize={RESULT_COUNT_PER_PAGE}
                    onPageChange={handlePageChange}
                  />
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                  <EmptyState
                    type="search"
                    actionLabel={hasActiveFilters ? 'Clear all filters' : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Filter Overlay */}
        {showFilters && (
          <>
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setShowFilters(false)}
            />
            <aside className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 lg:hidden overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    aria-label="Close filters"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <FilterSidebar
                  categories={categories}
                  barriers={barriers}
                  conditions={conditions}
                  minRating={minRating}
                  ratingStars={ratingStars}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  maxDistance={maxDistance}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onConditionsChange={handleConditionsChange}
                  onMinRatingChange={handleMinRatingChange}
                  onRatingStarsChange={handleRatingStarsChange}
                  onPriceChange={handlePriceChange}
                  onMaxDistanceChange={handleMaxDistanceChange}
                  onClearFilters={hasActiveFilters ? clearFilters : undefined}
                />
              </div>
            </aside>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col">
          <Navbar />
          <main className="flex-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}