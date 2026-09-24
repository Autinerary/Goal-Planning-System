import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRatingsByResource } from '@/lib/supabase/queries'

type SortOption = 'date' | 'rating' | 'distance'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || user.id
    const sort = (searchParams.get('sort') as SortOption) || 'date'
    const categoryFilter = searchParams.get('category')
    const status = searchParams.get('status') as 'wishlist' | 'current' | 'past' | null

    // Ensure user can only access their own resources
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch saved resources with resource details
    let query = supabase
      .from('saved_resources')
      .select(
        `
        *,
        resource:resources(*)
      `
      )
      .eq('user_id', userId)

    // Filter by status if provided (defaults to 'wishlist' for backwards compatibility)
    if (status) {
      query = query.eq('status', status)
    } else {
      // Default to 'wishlist' if no status specified (for SavedTab)
      query = query.eq('status', 'wishlist')
    }

    const { data: savedResources, error } = await query

    if (error) {
      console.error('Error fetching saved resources:', error)
      return NextResponse.json({ error: 'Failed to fetch saved resources' }, { status: 500 })
    }

    if (!savedResources || savedResources.length === 0) {
      return NextResponse.json({ resources: [], categories: [], unavailable: 0 })
    }

    // Drop rows whose embedded resource did not resolve.
    //
    // saved_resources is readable whenever it is YOURS, but `resources` is
    // only readable when status = 'approved' or you submitted it. Those two
    // policies disagree the moment a resource you already saved stops being
    // approved -- it goes back under review, or an admin removes it. Your
    // saved row survives and the join comes back `resource: null`.
    //
    // That null reached the client, which did `resource.location` and took
    // the whole page down with "Cannot read properties of null (reading
    // 'location')" -- the error testers hit on Wishlist and My Resources.
    // There is nothing to render for a resource we are not allowed to read,
    // so it is dropped here rather than being handed onward as a hazard.
    // The count travels with the response so the UI can say an item is
    // missing instead of letting it vanish without explanation. Nothing is
    // deleted: the saved_resources row is untouched and reappears by itself
    // if the resource is approved again.
    const resolved = savedResources.filter((sr: any) => sr.resource)
    const unavailable = savedResources.length - resolved.length

    // Filter by category if provided
    let filtered = resolved
    if (categoryFilter) {
      filtered = resolved.filter((sr: any) => sr.resource?.category === categoryFilter)
    }

    // Get rating data for each resource
    const resourcesWithRatings = await Promise.all(
      filtered.map(async (sr: any) => {
        const ratings = await getRatingsByResource(sr.resource_id)
        const averageRating =
          ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.overall_score, 0) / ratings.length : 0

        return {
          ...sr,
          averageRating,
          ratingCount: ratings.length,
        }
      })
    )

    // Sort resources
    let sorted = resourcesWithRatings
    switch (sort) {
      case 'rating':
        sorted = resourcesWithRatings.sort((a: any, b: any) => b.averageRating - a.averageRating)
        break
      case 'distance':
        // Distance sorting would require user location - for now, skip
        break
      case 'date':
      default:
        sorted = resourcesWithRatings.sort(
          (a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    // Get unique categories
    const categories = [
      ...new Set(resolved.map((sr: any) => sr.resource?.category).filter(Boolean)),
    ] as string[]

    return NextResponse.json({ resources: sorted, categories, unavailable })
  } catch (error) {
    console.error('Error in saved resources API:', error)
    return NextResponse.json({ error: 'Failed to fetch saved resources' }, { status: 500 })
  }
}