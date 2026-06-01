import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'

    // Build query
    let query = supabase.from('moderation_queue').select('*')

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Get moderation items with user emails
    const { data: items, error } = await query.order('created_at', { ascending: false }).limit(100)

    if (error) {
      throw error
    }

    // Get user emails for each item
    const userIds = [...new Set(items?.map((item) => item.submitted_by) || [])]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds)

    const emailMap = new Map(profiles?.map((p) => [p.id, p.email]) || [])

    // Get item data (rating or resource)
    const enrichedItems = await Promise.all(
      (items || []).map(async (item) => {
        let itemData = null

        if (item.item_type === 'rating') {
          const { data: rating } = await supabase
            .from('ratings')
            .select('*')
            .eq('id', item.item_id)
            .single()
          itemData = rating
        } else if (item.item_type === 'resource') {
          const { data: resource } = await supabase
            .from('resources')
            .select('*')
            .eq('id', item.item_id)
            .single()
          itemData = resource
        }

        return {
          ...item,
          user_email: emailMap.get(item.submitted_by) || item.submitted_by,
          item_data: itemData,
        }
      })
    )

    // Calculate stats
    const { data: allItems } = await supabase
      .from('moderation_queue')
      .select('status')

    const stats = {
      pending: allItems?.filter((i) => i.status === 'pending').length || 0,
      approved: allItems?.filter((i) => i.status === 'approved').length || 0,
      rejected: allItems?.filter((i) => i.status === 'rejected').length || 0,
      total: allItems?.length || 0,
    }

    return NextResponse.json({
      items: enrichedItems,
      stats,
    })
  } catch (error) {
    console.error('Error fetching moderation items:', error)
    return NextResponse.json({ error: 'Failed to fetch moderation items' }, { status: 500 })
  }
}