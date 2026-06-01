'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ResourceCard from '@/components/resources/ResourceCard'
import { ResourceCardSkeleton } from '@/components/ui/Skeleton'
import FilterSidebar from '@/components/search/FilterSidebar'
import SearchBar from '@/components/search/SearchBar'
import SortSelect from '@/components/search/SortSelect'
import ViewToggle from '@/components/search/ViewToggle'
import Pagination from '@/components/search/Pagination'
import EmptyState from '@/components/feedback/EmptyState'
import ErrorState from '@/components/feedback/ErrorState'
import { Search, Filter, X } from 'lucide-react'
import type { SearchFilters, SortOption, SearchResult } from '@/lib/supabase/queries'

const RESULT_COUNT_PER_PAGE = 20

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
  const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined
  const maxDistance = searchParams.get('maxDistance') ? Number(searchParams.get('maxDistance')) : undefined
  const sort = (searchParams.get('sort') as SortOption) || 'relevance'
  const page = Number(searchParams.get('page') || '1')

  // Update URL params
  const updateSearchParams = useCallback(
    (updates: Record<string, string | undefined>) => {
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
        const response = await fetch(
          `/api/search?${new URLSearchParams({
            q: query,
            categories: categories.join(','),
            barriers: barriers.join(','),
            minRating: minRating?.toString() || '',
            maxDistance: maxDistance?.toString() || '',
            sort,
            page: page.toString(),
            pageSize: RESULT_COUNT_PER_PAGE.toString(),
          })}`
        )

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
  }, [query, categories.join(','), barriers.join(','), minRating, maxDistance, sort, page])

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
    (newSort: SortOption) => {
      updateSearchParams({ sort: newSort })
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
      minRating: undefined,
      maxDistance: undefined,
      sort: 'relevance',
    })
  }, [updateSearchParams])

  const hasActiveFilters = categories.length > 0 || barriers.length > 0 || minRating !== undefined || maxDistance !== undefined

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
                  minRating={minRating}
                  maxDistance={maxDistance}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onMinRatingChange={handleMinRatingChange}
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
                          {categories.length + barriers.length + (minRating ? 1 : 0) + (maxDistance ? 1 : 0)}
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
                    <SortSelect value={sort} onChange={handleSortChange} />
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
                  minRating={minRating}
                  maxDistance={maxDistance}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onMinRatingChange={handleMinRatingChange}
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