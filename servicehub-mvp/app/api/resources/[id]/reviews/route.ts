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

    // Check if current user has rated
    let userHasRated = false
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const userRating = await getRatingByUserAndResource(params.id, user.id)
        userHasRated = !!userRating
      }
    } catch (error) {
      // Silently fail if user check fails
    }

    return NextResponse.json({
      reviews: paginatedReviews,
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