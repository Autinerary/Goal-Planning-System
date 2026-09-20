import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications/service'

/**
 * POST /api/ratings/[id]/helpful — toggle your "helpful" vote on a review.
 *
 * This used to call markRatingHelpful(), which did a bare
 * helpful_count = helpful_count + 1. Nothing recorded who had voted, so a
 * tester could sit on the button and run a review's count up without
 * limit, skewing both the "Most Helpful" sort and the badge rollups.
 *
 * The vote now lives in rating_helpful_votes, whose primary key is
 * (rating_id, user_id) — one per person, enforced by the database rather
 * than by the client. A second press removes your vote instead of adding
 * another, and a trigger keeps ratings.helpful_count in step.
 *
 * Returns the new state so the UI can render the button accurately rather
 * than guessing with a local +1.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: rating, error: ratingError } = await supabase
      .from('ratings')
      .select('id, user_id, resource_id')
      .eq('id', params.id)
      .single()

    if (ratingError || !rating) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // You don't get to boost your own review.
    if (rating.user_id === user.id) {
      return NextResponse.json(
        { error: 'You cannot mark your own review as helpful' },
        { status: 403 },
      )
    }

    const { data: existing } = await supabase
      .from('rating_helpful_votes')
      .select('rating_id')
      .eq('rating_id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    let voted: boolean

    if (existing) {
      const { error } = await supabase
        .from('rating_helpful_votes')
        .delete()
        .eq('rating_id', params.id)
        .eq('user_id', user.id)
      if (error) {
        console.error('Error removing helpful vote:', error)
        return NextResponse.json({ error: 'Failed to update your vote' }, { status: 500 })
      }
      voted = false
    } else {
      const { error } = await supabase
        .from('rating_helpful_votes')
        .insert({ rating_id: params.id, user_id: user.id })
      // 23505 = someone double-clicked and both requests raced. The row the
      // other one wrote is the outcome we wanted, so treat it as success.
      if (error && error.code !== '23505') {
        console.error('Error adding helpful vote:', error)
        return NextResponse.json({ error: 'Failed to update your vote' }, { status: 500 })
      }
      voted = true
    }

    // Read the trigger-maintained total back rather than computing it here.
    const { data: updated } = await supabase
      .from('ratings')
      .select('helpful_count')
      .eq('id', params.id)
      .single()

    const helpfulCount = updated?.helpful_count ?? 0

    // Only notify on a new vote, so toggling doesn't spam the author either.
    if (voted) {
      await sendNotification(rating.user_id, 'rating_helpful', {
        ratingId: params.id,
        resourceId: rating.resource_id,
        helpfulCount,
      })
    }

    return NextResponse.json({ success: true, voted, helpful_count: helpfulCount })
  } catch (error) {
    console.error('Error marking rating helpful:', error)
    return NextResponse.json({ error: 'Failed to mark rating helpful' }, { status: 500 })
  }
}
