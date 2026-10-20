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
import UnderstoodBanner from '@/components/search/UnderstoodBanner'
import TeamAction from '@/components/team/TeamAction'
import type { Understood } from '@/lib/search/understand'
import type { TeamState } from '@/lib/team'
import { useMyProfile } from '@/lib/useMyProfile'
import { findNorm, normForSearch } from '@/lib/onboarding/setup'
import { track } from '@/lib/track'
import CommunityChoiceBanner from '@/components/communityChoice/CommunityChoiceBanner'
import FoundSummary from '@/components/search/FoundSummary'
import SponsoredCard from '@/components/search/SponsoredCard'
import TidbitCommentaries from '@/components/search/TidbitCommentaries'
import type { TidbitCommentary } from '@/lib/search/tidbitCommentaries'
import { ACTIVITIES } from '@/lib/search/keywordFilters'
import { SPECIAL_TAGS, SOURCE_TYPES, THERAPY_SUBTYPES, THERAPY_TYPES, TRENDING_FILTERS } from '@/lib/filters/taxonomy'

/** Where "near" is, as the search API reports it (Riipen Labs, Group 8). */
interface NearInfo {
  nearFirst: boolean
  radiusKm?: number
  nearCount?: number
  place: string | null
  signedIn: boolean
}

const isNear = (r: { distance?: number }, radiusKm: number) => r.distance !== undefined && r.distance <= radiusKm

/** Fewer near results than this, and the page says how few (Group 8:
 *  "a clear fallback message when local results are sparse"). */
const SPARSE = 3

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
  // How the search was read (lib/search/understand.ts), and where each place
  // on the page is on the person's team (lib/team.ts).
  const [understood, setUnderstood] = useState<Understood | null>(null)
  const [team, setTeam] = useState<Record<string, TeamState>>({})
  // The person's own tags on the page (in their support team, owned, read),
  // and their country, for Education's school system.
  const [mine, setMine] = useState<Record<string, string[]>>({})
  // Tidbits as commentaries (lib/search/tidbitCommentaries.ts), and each
  // listing's Trending tier, for the shining badge on its card.
  const [tidbits, setTidbits] = useState<TidbitCommentary[]>([])
  const [tiers, setTiers] = useState<Record<string, string>>({})
  const [country, setCountry] = useState<string | null>(null)
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
  // Activities and therapy kinds (the team's notes, October 2026).
  const activities = searchParams.get('activities')?.split(',').filter(Boolean) || []
  const therapy = searchParams.get('therapy')?.split(',').filter(Boolean) || []
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
  // Enter on a sentence asks AI to read it (ai=1); exact=1 is "Search the
  // exact words instead"; drop= the parts taken away from what was understood.
  const ai = searchParams.get('ai') === '1'
  const exact = searchParams.get('exact') === '1'
  const drop = searchParams.get('drop')?.split(',').filter(Boolean) || []
  // Tags, free or paid, online, and the age of a service (lib/filters/tags.ts).
  const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const costType = (['free', 'paid'] as const).find((c) => c === searchParams.get('cost'))
  const online = searchParams.get('online') === '1'
  const shortWait = searchParams.get('wait') === 'short'
  const serviceAge = searchParams.get('age') || undefined
  // Near a given point instead of the profile's place (the campus pages).
  const near = searchParams.get('near') || ''
  const nearName = searchParams.get('nearName') || ''
  // Back from signing in to add a service to the team.
  const then = searchParams.get('then') || ''
  const addAfterSignIn = then.startsWith('team:') ? then.slice(5) : ''

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
          activities: activities.join(','),
          therapy: therapy.join(','),
          ratingStars: ratingStars.join(','),
          minRating: minRating?.toString() || '',
          minPrice: minPrice?.toString() || '',
          maxPrice: maxPrice?.toString() || '',
          maxDistance: maxDistance?.toString() || '',
          sort: sortParam,
          page: page.toString(),
          pageSize: RESULT_COUNT_PER_PAGE.toString(),
          ai: ai ? '1' : '',
          exact: exact ? '1' : '',
          drop: drop.join(','),
          near,
          nearName,
          tags: tags.join(','),
          cost: costType || '',
          online: online ? '1' : '',
          wait: shortWait ? 'short' : '',
          age: serviceAge || '',
        })
        const response = await fetch(`/api/search?${apiParams.toString()}`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to fetch search results')
        }

        const data = await response.json()
        setUnderstood(data.understood || null)
        setTeam(data.team || {})
        setMine(data.mine || {})
        setCountry(data.you?.country || null)
        setResults(data.results || [])
        setTidbits(Array.isArray(data.tidbits) ? data.tidbits : [])
        // The page's Trending tiers, in one request (get_resource_badges).
        const ids = (data.results || []).filter((r: any) => r.kind !== 'product').map((r: any) => r.id)
        setTiers({})
        if (ids.length) {
          fetch('/api/resources/badges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resourceIds: ids }) })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
              const next: Record<string, string> = {}
              for (const [id, b] of Object.entries((j?.badges || {}) as Record<string, { trendingTier?: string | null }>)) if (b.trendingTier) next[id] = b.trendingTier
              setTiers(next)
            })
            .catch(() => {})
        }
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
        setTidbits([])
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
    activities.join(','),
    therapy.join(','),
    ratingStars.join(','),
    minRating,
    minPrice,
    maxPrice,
    maxDistance,
    sortParam,
    page,
    ai,
    exact,
    drop.join(','),
    near,
    nearName,
    tags.join(','),
    costType,
    online,
    shortWait,
    serviceAge,
  ])

  // A new search starts a new reading: AI only on Enter.
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      updateSearchParams({ q: newQuery, ai: undefined, exact: undefined, drop: undefined })
    },
    [updateSearchParams]
  )
  const handleQuerySubmit = useCallback(
    (newQuery: string) => {
      updateSearchParams({ q: newQuery, ai: '1', exact: undefined, drop: undefined })
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

  const handleActivityToggle = useCallback(
    (id: string) => {
      updateSearchParams({ activities: activities.includes(id) ? activities.filter((a) => a !== id) : [...activities, id] })
    },
    [activities, updateSearchParams]
  )

  const handleTherapyToggle = useCallback(
    (id: string) => {
      updateSearchParams({ therapy: therapy.includes(id) ? therapy.filter((t) => t !== id) : [...therapy, id] })
    },
    [therapy, updateSearchParams]
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

  const handleTagToggle = useCallback(
    (id: string) => {
      updateSearchParams({ tags: tags.includes(id) ? tags.filter((t) => t !== id) : [...tags, id] })
    },
    [tags, updateSearchParams]
  )
  // Sorting by cost is offered once "Paid" is chosen; leaving Paid drops it.
  const handleCostTypeChange = useCallback(
    (next: 'free' | 'paid' | undefined) => {
      const keep = sortRules.filter((r) => next === 'paid' || r.key !== 'cost')
      updateSearchParams({ cost: next, sort: keep.length === sortRules.length ? searchParams.get('sort') || undefined : encodeSortRules(keep) || undefined })
    },
    [sortRules, searchParams, updateSearchParams]
  )
  const handleOnlineChange = useCallback((next: boolean) => updateSearchParams({ online: next ? '1' : undefined }), [updateSearchParams])
  const handleShortWaitChange = useCallback((next: boolean) => updateSearchParams({ wait: next ? 'short' : undefined }), [updateSearchParams])
  const handleServiceAgeChange = useCallback((next: string | undefined) => updateSearchParams({ age: next }), [updateSearchParams])

  const clearFilters = useCallback(() => {
    updateSearchParams({
      q: '',
      categories: undefined,
      barriers: undefined,
      conditions: undefined,
      lifeAreas: undefined,
      connectionTypes: undefined,
      ageRanges: undefined,
      specialTags: undefined,
      sourceTypes: undefined,
      activities: undefined,
      therapy: undefined,
      ratingStars: undefined,
      minRating: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      maxDistance: undefined,
      tags: undefined,
      cost: undefined,
      online: undefined,
      wait: undefined,
      age: undefined,
      sort: 'relevance',
    })
  }, [updateSearchParams])

  // How many filters are on, for the phone's "Filters" button: every one
  // hasActiveFilters counts (it showed 0 with a tag, a cost or a wait on).
  const activeFilterCount =
    categories.length +
    barriers.length +
    conditions.length +
    lifeAreas.length +
    (ratingStars.length > 0 ? 1 : 0) +
    (minRating !== undefined ? 1 : 0) +
    (minPrice !== undefined || maxPrice !== undefined ? 1 : 0) +
    (maxDistance !== undefined ? 1 : 0) +
    connectionTypes.length +
    ageRanges.length +
    specialTags.length +
    sourceTypes.length +
    activities.length +
    therapy.length +
    tags.length +
    (costType !== undefined ? 1 : 0) +
    (online ? 1 : 0) +
    (shortWait ? 1 : 0) +
    (serviceAge !== undefined ? 1 : 0)
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
    sourceTypes.length > 0 ||
    activities.length > 0 ||
    therapy.length > 0 ||
    tags.length > 0 ||
    costType !== undefined ||
    online ||
    shortWait ||
    serviceAge !== undefined

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
    specialTags.some((t) => t === 'rare' || t === 'highly_requested' || t.startsWith('trending_'))

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
              onSubmit={handleQuerySubmit}
              placeholder="Say what you need, e.g. a quiet pool for my son near Kitchener"
              label="Search: say what you need"
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
                  activities={activities}
                  therapy={therapy}
                  onActivityToggle={handleActivityToggle}
                  onTherapyToggle={handleTherapyToggle}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onLifeAreaToggle={handleLifeAreaToggle}
                  onConditionsChange={handleConditionsChange}
                  onMinRatingChange={handleMinRatingChange}
                  onRatingStarsChange={handleRatingStarsChange}
                  onPriceChange={handlePriceChange}
                  onMaxDistanceChange={handleMaxDistanceChange}
                  onClearFilters={hasActiveFilters ? clearFilters : undefined}
                  place={nearInfo?.place}
                  signedIn={nearInfo?.signedIn}
                  tags={tags}
                  costType={costType}
                  online={online}
                  serviceAge={serviceAge}
                  country={country}
                  onTagToggle={handleTagToggle}
                  onCostTypeChange={handleCostTypeChange}
                  onOnlineChange={handleOnlineChange}
                  shortWait={shortWait}
                  onShortWaitChange={handleShortWaitChange}
                  onServiceAgeChange={handleServiceAgeChange}
                />
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              {!error && !loading && understood && (
                <UnderstoodBanner
                  understood={understood}
                  onDrop={(part) => updateSearchParams({ drop: Array.from(new Set([...drop, part])) })}
                  onExact={() => updateSearchParams({ exact: '1', ai: undefined, drop: undefined })}
                  onFilterNorms={(ids) => updateSearchParams({ barriers: Array.from(new Set([...barriers, ...ids])) })}
                  onFilterAges={(ranges) => updateSearchParams({ ageRanges: Array.from(new Set([...ageRanges, ...ranges])) })}
                  normsApplied={understood.norms.some((n) => barriers.includes(n.id))}
                  agesApplied={understood.ages.some((a) => a.ranges.some((r) => ageRanges.includes(r)))}
                />
              )}
              {/* A sponsored listing, only when the team turns them on (Resource Accounts; off: the privacy page says we don't show ads). */}
              {page === 1 && !loading && !error && (searchParams.get('q') || categories.length > 0) && (
                <SponsoredCard q={searchParams.get('q') || ''} category={categories[0] || understood?.intents[0]?.id || ''} province={understood?.place?.province || ''} />
              )}
              {/* After Enter: "Here's what we found!" (Goal 7), above the full list. */}
              {ai && page === 1 && !loading && !error && results.some((r: any) => r.kind !== 'product') && (
                <FoundSummary
                  services={results.filter((r: any) => r.kind !== 'product')}
                  understood={understood}
                  query={searchParams.get('q') || ''}
                  team={team}
                  signedIn={Boolean(nearInfo?.signedIn)}
                  nearFirst={Boolean(nearInfo?.nearFirst)}
                  onTeamChange={(id, state) => setTeam((t) => ({ ...t, [id]: state }))}
                />
              )}
              <CommunityChoiceBanner />
              {/* Toolbar */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    {/* Named by what it shows ("Filters", and how many are on), so
                        a voice command for the words on screen works. */}
                    <button
                      onClick={() => setShowFilters(true)}
                      className="lg:hidden flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <Filter className="w-4 h-4" aria-hidden="true" />
                      Filters
                      {hasActiveFilters && (
                        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {activeFilterCount}
                          <span className="sr-only"> on</span>
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
                    <SortMultiSelect
                      value={sortRules}
                      onChange={handleSortChange}
                      allowCost={costType === 'paid'}
                      allowDistance={Boolean(nearInfo?.place)}
                    />
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
                    {[
                      ...activities.map((id) => ({ key: `act-${id}`, label: ACTIVITIES.find((a) => a.id === id)?.label || id, off: () => handleActivityToggle(id) })),
                      ...therapy.map((id) => ({
                        key: `th-${id}`,
                        label: `Therapy: ${THERAPY_TYPES.find((t) => t.id === id)?.label || Object.values(THERAPY_SUBTYPES).flat().find((t) => t.id === id)?.label || id}`,
                        off: () => handleTherapyToggle(id),
                      })),
                      ...specialTags.map((id) => ({
                        key: `sp-${id}`,
                        label: SPECIAL_TAGS.find((t) => t.id === id)?.label || (TRENDING_FILTERS.find((t) => t.id === id) ? `Trending ${TRENDING_FILTERS.find((t) => t.id === id)!.label.toLowerCase()}` : id),
                        off: () => handleSpecialTagToggle(id),
                      })),
                      ...sourceTypes.map((id) => ({ key: `src-${id}`, label: `Source: ${SOURCE_TYPES.find((t) => t.id === id)?.label || id}`, off: () => handleSourceTypeToggle(id) })),
                    ].map((chip) => (
                      <button
                        key={chip.key}
                        onClick={chip.off}
                        className="inline-flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {chip.label}
                        <X className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">(remove)</span>
                      </button>
                    ))}
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
              {/* Only a few near: say so, so "Broader options" is no surprise. */}
              {!error && !loading && radiusKm !== undefined && page === 1 && (nearInfo?.nearCount ?? 0) > 0 &&
                (nearInfo?.nearCount ?? 0) < SPARSE && results.length > (nearInfo?.nearCount ?? 0) && (
                <p className="mb-4 flex flex-wrap items-center gap-x-2 text-sm text-gray-700" role="status">
                  <MapPin className="h-4 w-4 flex-shrink-0 text-violet-700" aria-hidden="true" />
                  Only {nearInfo?.nearCount} {nearInfo?.nearCount === 1 ? 'place' : 'places'} within {radiusKm} km of{' '}
                  {nearInfo?.place || 'you'} {nearInfo?.nearCount === 1 ? 'matches' : 'match'} this search. Broader options are
                  below.
                  <Link href="/profile#location" className="font-medium text-blue-700 underline">
                    Change location
                  </Link>
                </p>
              )}
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

              {/* Tidbits as commentaries, when Commentaries or the Tidbits source is chosen. */}
              {!error && !loading && page === 1 && <TidbitCommentaries tidbits={tidbits} query={query} />}

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
                              mine={mine[resource.id] || []}
                              locationShared={Boolean(nearInfo?.place)}
                              trendingTier={tiers[resource.id]}
                              footer={
                                (resource as any).kind === 'product' ? undefined : (
                                  <TeamAction
                                    resource={resource}
                                    initial={team[resource.id] || 'none'}
                                    signedIn={Boolean(nearInfo?.signedIn)}
                                    autoAdd={addAfterSignIn === resource.id}
                                    onChange={(state) => setTeam((t) => ({ ...t, [resource.id]: state }))}
                                  />
                                )
                              }
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
              ) : !error && tidbits.length > 0 ? null : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
                  <EmptyState
                    type="search"
                    message={
                      shortWait
                        ? 'Few services have a wait on record yet. People say how long they waited when they rate a service, and services can say their own wait. Try without “Short wait”, or rate a service you used to help others.'
                        : communityFilterActive
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
                  activities={activities}
                  therapy={therapy}
                  onActivityToggle={handleActivityToggle}
                  onTherapyToggle={handleTherapyToggle}
                  onCategoryToggle={handleCategoryToggle}
                  onBarrierToggle={handleBarrierToggle}
                  onLifeAreaToggle={handleLifeAreaToggle}
                  onConditionsChange={handleConditionsChange}
                  onMinRatingChange={handleMinRatingChange}
                  onRatingStarsChange={handleRatingStarsChange}
                  onPriceChange={handlePriceChange}
                  onMaxDistanceChange={handleMaxDistanceChange}
                  onClearFilters={hasActiveFilters ? clearFilters : undefined}
                  place={nearInfo?.place}
                  signedIn={nearInfo?.signedIn}
                  tags={tags}
                  costType={costType}
                  online={online}
                  serviceAge={serviceAge}
                  country={country}
                  onTagToggle={handleTagToggle}
                  onCostTypeChange={handleCostTypeChange}
                  onOnlineChange={handleOnlineChange}
                  shortWait={shortWait}
                  onShortWaitChange={handleShortWaitChange}
                  onServiceAgeChange={handleServiceAgeChange}
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