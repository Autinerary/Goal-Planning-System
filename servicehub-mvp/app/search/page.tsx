'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
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
import { Search, Filter, X, MapPin } from 'lucide-react'
import type { SearchResult } from '@/lib/supabase/queries'
import AddTopicPrompt from '@/components/prompts/AddTopicPrompt'
import { useMyProfile } from '@/lib/useMyProfile'
import { findNorm, normForSearch } from '@/lib/onboarding/setup'
import { track } from '@/lib/track'

/** Where "near" is, as the search API reports it (Riipen Labs, Group 8). */
interface NearInfo {
  nearFirst: boolean
  radiusKm?: number
  nearCount?: number
  place: string | null
  signedIn: boolean
}

const isNear = (r: { distance?: number }, radiusKm: number) => r.distance !== undefined && r.distance <= radiusKm

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
  // The API already reports how many of the results are shop items; the UI
  // was discarding it. Without it, filtering to a Shop category shows a
  // count with no hint that every row is a product, not a service.
  const [productCount, setProductCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; type?: string } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [nearInfo, setNearInfo] = useState<NearInfo | null>(null)
  const { profile, setProfile } = useMyProfile()
  // One rh_search event per search, not per render.
  const trackedSearch = useRef<string>('')

  // Extract filters from URL
  const query = searchParams.get('q') || ''
  const categories = searchParams.get('categories')?.split(',').filter(Boolean) || []
  const barriers = searchParams.get('barriers')?.split(',').filter(Boolean) || []
  const conditions = searchParams.get('conditions')?.split(',').filter(Boolean) || []
  const lifeAreas = searchParams.get('lifeAreas')?.split(',').filter(Boolean) || []
  // Odosa's three new groups. Same URL-derived pattern as the others, so a
  // filtered search stays shareable and survives a refresh.
  const connectionTypes = searchParams.get('connectionTypes')?.split(',').filter(Boolean) || []
  const ageRanges = searchParams.get('ageRanges')?.split(',').filter(Boolean) || []
  const specialTags = searchParams.get('specialTags')?.split(',').filter(Boolean) || []
  const sourceTypes = searchParams.get('sourceTypes')?.split(',').filter(Boolean) || []
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
          lifeAreas: lifeAreas.join(','),
          connectionTypes: connectionTypes.join(','),
          ageRanges: ageRanges.join(','),
          specialTags: specialTags.join(','),
          sourceTypes: sourceTypes.join(','),
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
        setProductCount(data.productCount || 0)
        const info: NearInfo = {
          nearFirst: Boolean(data.nearFirst),
          radiusKm: data.radiusKm,
          nearCount: data.nearCount,
          place: data.you?.place || null,
          signedIn: Boolean(data.you?.signedIn),
        }
        setNearInfo(info)
        // How many of the first page are near, for Group 8's measure
        // "the percentage of search results returned within the user's
        // stated radius". Places only: shop items have no address.
        if (info.nearFirst && info.radiusKm && page === 1) {
          const places = (data.results || []).filter((r: any) => r.kind !== 'product').slice(0, 20)
          const signature = apiParams.toString()
          if (places.length > 0 && trackedSearch.current !== signature) {
            trackedSearch.current = signature
            const near = places.filter((r: any) => isNear(r, info.radiusKm as number)).length
            track('rh_search', `${near}/${places.length}`)
          }
        }
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
        setProductCount(0)
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
    lifeAreas.join(','),
    connectionTypes.join(','),
    ageRanges.join(','),
    specialTags.join(','),
    sourceTypes.join(','),
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

  // Odosa's three new filter groups. One shared shape — toggle membership in
  // the list and push it to the URL — so they behave exactly like the
  // existing category/barrier filters do.
  const handleConnectionTypeToggle = useCallback(
    (id: string) => {
      updateSearchParams({
        connectionTypes: connectionTypes.includes(id)
          ? connectionTypes.filter((c) => c !== id)
          : [...connectionTypes, id],
      })
    },
    [connectionTypes, updateSearchParams]
  )

  const handleAgeRangeToggle = useCallback(
    (id: string) => {
      updateSearchParams({
        ageRanges: ageRanges.includes(id)
          ? ageRanges.filter((a) => a !== id)
          : [...ageRanges, id],
      })
    },
    [ageRanges, updateSearchParams]
  )

  const handleSpecialTagToggle = useCallback(
    (id: string) => {
      updateSearchParams({
        specialTags: specialTags.includes(id)
          ? specialTags.filter((t) => t !== id)
          : [...specialTags, id],
      })
    },
    [specialTags, updateSearchParams]
  )

  const handleSourceTypeToggle = useCallback(
    (id: string) => {
      updateSearchParams({
        sourceTypes: sourceTypes.includes(id)
          ? sourceTypes.filter((t) => t !== id)
          : [...sourceTypes, id],
      })
    },
    [sourceTypes, updateSearchParams]
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

  const handleLifeAreaToggle = useCallback(
    (area: string) => {
      const newAreas = lifeAreas.includes(area)
        ? lifeAreas.filter((a) => a !== area)
        : [...lifeAreas, area]
      updateSearchParams({ lifeAreas: newAreas })
    },
    [lifeAreas, updateSearchParams]
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
      lifeAreas: undefined,
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
    lifeAreas.length > 0 ||
    ratingStars.length > 0 ||
    minRating !== undefined ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    maxDistance !== undefined ||
    connectionTypes.length > 0 ||
    ageRanges.length > 0 ||
    specialTags.length > 0 ||
    sourceTypes.length > 0

  // A search for one topic that is not on the profile: offer to add it
  // (Riipen Labs, Group 8). From a condition filter, or the words searched.
  const topicSearched = (() => {
    for (const token of conditions) {
      const norm = findNorm(decodeCondition(token).id)
      if (norm) return norm
    }
    return query ? normForSearch(query) : undefined
  })()

  // Near first, split into "Near <place>" and "Broader options".
  const radiusKm = nearInfo?.nearFirst ? nearInfo.radiusKm : undefined
  const nearResults = radiusKm ? results.filter((r) => isNear(r, radiusKm)) : results
  const broaderResults = radiusKm ? results.filter((r) => !isNear(r, radiusKm)) : []
  const nearLabel = nearInfo?.place ? `Near ${nearInfo.place}` : 'Near you'

  // Filters that depend on what people have rated or saved find little until
  // more places are rated; say so instead of a bare "no results".
  const communityFilterActive =
    barriers.length > 0 ||
    connectionTypes.length > 0 ||
    ratingStars.length > 0 ||
    minRating !== undefined ||
    specialTags.some((t) => t === 'rare' || t === 'highly_requested')

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
              {/* Odosa: the filter list must scroll on its OWN. It was sticky but
                  unbounded, so a list taller than the viewport could only be
                  reached by scrolling past every result first — with 1000 results
                  the bottom filters were effectively unreachable. Capping the
                  height to the viewport and scrolling inside fixes that; the
                  inner sections keep their own scrollbars. */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto overscroll-contain">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>

                <FilterSidebar
                  categories={categories}
                  barriers={barriers}
                  conditions={conditions}
                  lifeAreas={lifeAreas}
                  minRating={minRating}
                  ratingStars={ratingStars}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  maxDistance={maxDistance}
                  connectionTypes={connectionTypes}
                  ageRanges={ageRanges}
                  specialTags={specialTags}
                  sourceTypes={sourceTypes}
                  onConnectionTypeToggle={handleConnectionTypeToggle}
                  onAgeRangeToggle={handleAgeRangeToggle}
                  onSpecialTagToggle={handleSpecialTagToggle}
                  onSourceTypeToggle={handleSourceTypeToggle}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onLifeAreaToggle={handleLifeAreaToggle}
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
                              {/* Say what the mix is. Selecting a Shop category
                                  returns only products — no resource has the
                                  category "books" — and a bare count made that
                                  look like the service search had failed. */}
                              {productCount > 0 && (
                                <span className="text-gray-500">
                                  {' '}
                                  ({total - productCount === 0
                                    ? `all ${productCount === 1 ? 'a shop item' : 'shop items'}`
                                    : `${total - productCount} ${total - productCount === 1 ? 'service' : 'services'}, ${productCount} shop ${productCount === 1 ? 'item' : 'items'}`})
                                </span>
                              )}
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

              {/* Where results are measured from (Riipen Labs, Group 8) */}
              {!error && !loading && radiusKm !== undefined && page === 1 && nearInfo?.nearCount === 0 && results.length > 0 && (
                <div className="mb-6 rounded-lg border border-violet-200 bg-violet-50 p-4" role="status">
                  <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    Nothing within {radiusKm} km of {nearInfo?.place || 'you'} matches this search
                  </p>
                  <p className="mt-1 text-sm text-violet-900/80">
                    Showing organisations for your province or all of Canada first, then the nearest places
                    farther away.{' '}
                    <Link href="/profile#location" className="font-medium underline">
                      Change location
                    </Link>
                  </p>
                </div>
              )}
              {!error && !loading && nearInfo?.signedIn && !nearInfo.place && results.length > 0 && (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-blue-900">
                    <MapPin className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    Set your location to see places near you first. It is private and optional.
                  </p>
                  <Link
                    href="/profile#location"
                    className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    Set location
                  </Link>
                </div>
              )}
              {!loading && topicSearched && profile?.signedIn && (
                <AddTopicPrompt norm={topicSearched} profile={profile} onSaved={setProfile} />
              )}

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
                  {[
                    { key: 'near', heading: radiusKm !== undefined ? nearLabel : null, items: nearResults },
                    { key: 'broader', heading: 'Broader options', items: broaderResults },
                  ]
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <section key={group.key} aria-label={group.heading || undefined}>
                        {group.heading && (
                          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
                            {group.heading}
                          </h2>
                        )}
                        <div
                          className={
                            viewMode === 'grid'
                              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'
                              : 'space-y-4 mb-8'
                          }
                        >
                          {group.items.map((resource) => (
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
                      </section>
                    ))}

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
                    message={
                      communityFilterActive
                        ? 'Some of these filters use ratings and saves from the community, and few places have been rated yet. Try fewer filters, or rate a place you know to help others.'
                        : undefined
                    }
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
                  lifeAreas={lifeAreas}
                  minRating={minRating}
                  ratingStars={ratingStars}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  maxDistance={maxDistance}
                  connectionTypes={connectionTypes}
                  ageRanges={ageRanges}
                  specialTags={specialTags}
                  sourceTypes={sourceTypes}
                  onConnectionTypeToggle={handleConnectionTypeToggle}
                  onAgeRangeToggle={handleAgeRangeToggle}
                  onSpecialTagToggle={handleSpecialTagToggle}
                  onSourceTypeToggle={handleSourceTypeToggle}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onLifeAreaToggle={handleLifeAreaToggle}
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