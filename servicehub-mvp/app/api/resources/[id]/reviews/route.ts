import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRatingsByResource, getRatingByUserAndResource } from '@/lib/supabase/queries'
import { getProfile } from '@/lib/supabase/queries'

type SortOption = 'helpful' | 'newest' | 'highest'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sort = (searchParams.get('sort') as SortOption) || 'newest'
    const page = Number(searchParams.get('page') || '1')
    const pageSize = Number(searchParams.get('pageSize') || '10')

    // Get all ratings
    let ratings = await getRatingsByResource(params.id)

    // Get user profiles for ratings
    const userIds = [...new Set(ratings.map((r) => r.user_id))]
    const profiles = await Promise.all(userIds.map((id) => getProfile(id)))

    const profileMap = new Map(profiles.filter(Boolean).map((p) => [p!.id, p!]))

    // Attach user profiles to ratings
    let reviewsWithUsers = ratings.map((rating) => ({
      ...rating,
      user: profileMap.get(rating.user_id),
    }))

    // Sort reviews
    switch (sort) {
      case 'helpful':
        reviewsWithUsers.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0))
        break
      case 'highest':
        reviewsWithUsers.sort((a, b) => b.overall_score - a.overall_score)
        break
      case 'newest':
      default:
        reviewsWithUsers.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    const total = reviewsWithUsers.length
    const offset = (page - 1) * pageSize
    const paginatedReviews = reviewsWithUsers.slice(offset, offset + pageSize)

    // Check if current user has rated, and which reviews on this page they
    // have already marked helpful. Without the second part the button cannot
    // render its own state, which is how it ended up looking like an endless
    // +1 instead of a vote you either have cast or have not.
    let userHasRated = false
    let viewerId: string | null = null
    let helpfulByViewer = new Set<string>()
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        viewerId = user.id
        const userRating = await getRatingByUserAndResource(params.id, user.id)
        userHasRated = !!userRating

        const pageIds = paginatedReviews.map((r) => r.id)
        if (pageIds.length > 0) {
          const { data: votes } = await supabase
            .from('rating_helpful_votes')
            .select('rating_id')
            .eq('user_id', user.id)
            .in('rating_id', pageIds)
          helpfulByViewer = new Set((votes ?? []).map((v: any) => v.rating_id))
        }
      }
    } catch (error) {
      // Silently fail if user check fails
    }

    const reviewsForViewer = paginatedReviews.map((r) => ({
      ...r,
      viewer_marked_helpful: helpfulByViewer.has(r.id),
      // You cannot vote your own review helpful, so the button is hidden.
      viewer_is_author: viewerId !== null && r.user_id === viewerId,
    }))

    return NextResponse.json({
      reviews: reviewsForViewer,
      total,
      page,
      pageSize,
      userHasRated,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews', reviews: [], total: 0, page: 1, pageSize: 10 },
      { status: 500 }
    )
  }
}