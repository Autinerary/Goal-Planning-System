import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { markRatingHelpful } from '@/lib/supabase/queries'
import { sendNotification } from '@/lib/notifications/service'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const success = await markRatingHelpful(params.id)

    if (!success) {
      return NextResponse.json({ error: 'Failed to mark rating helpful' }, { status: 500 })
    }

    // Get rating details to send notification
    const { data: rating } = await supabase
      .from('ratings')
      .select('user_id, resource_id, helpful_count')
      .eq('id', params.id)
      .single()

    // Send notification to rater (if not the current user)
    if (rating && rating.user_id !== user.id) {
      await sendNotification(rating.user_id, 'rating_helpful', {
        ratingId: params.id,
        resourceId: rating.resource_id,
        helpfulCount: rating.helpful_count || 1,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking rating helpful:', error)
    return NextResponse.json({ error: 'Failed to mark rating helpful' }, { status: 500 })
  }
}