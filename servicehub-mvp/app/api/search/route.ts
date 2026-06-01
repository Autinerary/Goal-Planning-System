import { NextRequest, NextResponse } from 'next/server'
import { searchResources, type SearchFilters, type SortOption } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { semanticResourceSearch } from '@/lib/supabase/vector-queries'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Extract query parameters
    const query = searchParams.get('q') || undefined
    const categories = searchParams.get('categories')
      ? searchParams.get('categories')!.split(',').filter(Boolean)
      : undefined
    const barriers = searchParams.get('barriers')
      ? searchParams.get('barriers')!.split(',').filter(Boolean)
      : undefined
    const minRating = searchParams.get('minRating')
      ? Number(searchParams.get('minRating'))
      : undefined
    const maxDistance = searchParams.get('maxDistance')
      ? Number(searchParams.get('maxDistance'))
      : undefined
    const sort = (searchParams.get('sort') as SortOption) || 'relevance'
    const page = Number(searchParams.get('page') || '1')
    const pageSize = Number(searchParams.get('pageSize') || '20')

    // Get user location from profile if authenticated
    let userLocation: { lat: number; lng: number } | undefined = undefined

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const profile = await supabase
          .from('profiles')
          .select('location')
          .eq('id', user.id)
          .single()

        if (profile.data?.location) {
          const location = profile.data.location as any
          if (location?.lat && location?.lng) {
            userLocation = { lat: location.lat, lng: location.lng }
          }
        }
      }
    } catch (error) {
      // Silently fail if user location can't be retrieved
      console.warn('Could not get user location:', error)
    }

    // Build filters
    const filters: SearchFilters = {
      query,
      categories,
      barriers,
      minRating,
      maxDistance,
      userLocation,
      status: 'approved',
    }

    // Option 1: Semantic search using vector DB (if query provided)
    let semanticResults: any[] = []
    if (query && query.trim().length > 0) {
      try {
        semanticResults = await semanticResourceSearch(query, pageSize * 2, 0.7, categories?.[0])

        // Filter by additional criteria
        if (minRating && semanticResults.length > 0) {
          const supabase = createClient()
          const resourceIds = semanticResults.map((r: any) => r.resource_id || r.id)
          const { data: ratings } = await supabase
            .from('ratings')
            .select('resource_id, overall_score')
            .in('resource_id', resourceIds)

          // Calculate average ratings
          const ratingMap = new Map<string, { sum: number; count: number }>()
          ratings?.forEach((r) => {
            const existing = ratingMap.get(r.resource_id) || { sum: 0, count: 0 }
            ratingMap.set(r.resource_id, {
              sum: existing.sum + r.overall_score,
              count: existing.count + 1,
            })
          })

          // Filter by minimum rating
          semanticResults = semanticResults.filter((r: any) => {
            const resourceId = r.resource_id || r.id
            const ratingData = ratingMap.get(resourceId)
            if (!ratingData || ratingData.count === 0) return false
            const avgRating = ratingData.sum / ratingData.count
            return avgRating >= minRating
          })
        }
      } catch (error) {
        console.error('Error in semantic search:', error)
        // Fall back to keyword search
      }
    }

    // Option 2: Traditional keyword search
    const keywordResult = await searchResources(filters, sort, page, pageSize)

    // Combine results: semantic results first (higher relevance), then keyword
    if (semanticResults.length > 0) {
      // Remove duplicates (prioritize semantic results)
      const seenIds = new Set(semanticResults.map((r: any) => r.resource_id || r.id))
      const uniqueKeywordResults = keywordResult.results.filter((r) => !seenIds.has(r.id))

      // Fetch full resource data for semantic results
      const supabase = createClient()
      const resourceIds = semanticResults.map((r: any) => r.resource_id || r.id)
      const { data: semanticResources } = await supabase
        .from('resources')
        .select('*')
        .in('id', resourceIds)
        .eq('status', 'approved')
        .limit(pageSize)

      // Merge results
      const combinedResults = [
        ...(semanticResources || []).map((r) => {
          const semanticMatch = semanticResults.find((s: any) => (s.resource_id || s.id) === r.id)
          return { ...r, similarity: semanticMatch?.similarity || 0 }
        }),
        ...uniqueKeywordResults,
      ].slice(0, pageSize)

      return NextResponse.json({
        results: combinedResults,
        total: combinedResults.length,
        page,
        pageSize,
        semanticCount: semanticResults.length,
        keywordCount: uniqueKeywordResults.length,
      })
    }

    // No semantic results, return keyword results
    return NextResponse.json(keywordResult)
  } catch (error) {
    console.error('Error in search API:', error)
    return NextResponse.json(
      { error: 'Failed to search resources', results: [], total: 0, page: 1, pageSize: 20 },
      { status: 500 }
    )
  }
}