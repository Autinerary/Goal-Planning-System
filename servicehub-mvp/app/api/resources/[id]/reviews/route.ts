import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getRatingsByResource,
  getReviewerProfiles,
} from '@/lib/supabase/queries'

type SortOption = 'helpful' | 'newest' | 'highest'

/**
 * GET /api/resources/[id]/reviews?sort=&page=&pageSize= — the review cards.
 *
 * Each review carries only what its card shows: the score, the per-area
 * scores, the comment, the date, the helpful count, the writer's name and
 * role, and whether the viewer wrote it or marked it helpful. It used to
 * spread the whole rating row beside the writer's name, including the
 * writer's own norms and their levels, how they relate to them and their
 * organisations (bug audit, 17 November 2026, item 2). User ids no longer go
 * out either.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const searchParams = request.nextUrl.searchParams
    const sortParam = searchParams.get('sort')
    const sort: SortOption = sortParam === 'helpful' || sortParam === 'highest' ? sortParam : 'newest'
    const page = Math.max(1, Math.floor(Number(searchParams.get('page') || '1')) || 1)
    const pageSize = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('pageSize') || '10')) || 10))

    let viewerId: string | null = null
    const supabase = createClient()
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      viewerId = user?.id ?? null
    } catch {
      // Signed out: the public list.
    }

    // The public ratings; a flagged one waits for a moderator, except for its author.
    const ratings = await getRatingsByResource(params.id, viewerId ?? undefined)

    // Sort reviews
    switch (sort) {
      case 'helpful':
        ratings.sort((a, b) => (b.helpful_count || 0) - (a.helpful_count || 0))
        break
      case 'highest':
        ratings.sort((a, b) => b.overall_score - a.overall_score)
        break
      case 'newest':
      default:
        ratings.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    const total = ratings.length
    const offset = (page - 1) * pageSize
    const pageRatings = ratings.slice(offset, offset + pageSize)

    // The writer's name and role, which is all the review card shows about
    // them, for this page's reviews only (Riipen Labs, Group 34).
    const reviewers = await getReviewerProfiles(pageRatings.map((r) => r.user_id))

    // Which reviews on this page the viewer has already marked helpful, so
    // the button can show its own state.
    const userHasRated = viewerId !== null && ratings.some((r) => r.user_id === viewerId)
    let helpfulByViewer = new Set<string>()
    if (viewerId && pageRatings.length > 0) {
      try {
        const { data: votes } = await supabase
          .from('rating_helpful_votes')
          .select('rating_id')
          .eq('user_id', viewerId)
          .in('rating_id', pageRatings.map((r) => r.id))
        helpfulByViewer = new Set((votes ?? []).map((v: { rating_id: string }) => v.rating_id))
      } catch {
        // The button shows as not pressed.
      }
    }

    const reviews = pageRatings.map((r) => ({
      id: r.id,
      overall_score: r.overall_score,
      barrier_scores: r.barrier_scores,
      comment: r.comment,
      helpful_count: r.helpful_count || 0,
      created_at: r.created_at,
      user: reviewers.get(r.user_id),
      viewer_marked_helpful: helpfulByViewer.has(r.id),
      // You cannot vote your own review helpful, so the button is hidden.
      viewer_is_author: viewerId !== null && r.user_id === viewerId,
    }))

    return NextResponse.json({
      reviews,
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
