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

    // Get total counts
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    // Total resources
    const { count: totalResources } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })

    // Resources this week
    const { count: resourcesThisWeek } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    // Resources last week (for growth calculation)
    const { count: resourcesLastWeek } = await supabase
      .from('resources')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())

    // Total ratings
    const { count: totalRatings } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })

    // Ratings this week
    const { count: ratingsThisWeek } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    // Ratings last week
    const { count: ratingsLastWeek } = await supabase
      .from('ratings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())

    // Total users
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    // Users this week
    const { count: usersThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo.toISOString())

    // Users last week
    const { count: usersLastWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twoWeeksAgo.toISOString())
      .lt('created_at', weekAgo.toISOString())

    // Pending moderation
    const { count: pendingModeration } = await supabase
      .from('moderation_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Calculate growth percentages
    const resourceGrowth =
      resourcesLastWeek && resourcesLastWeek > 0
        ? Math.round(((resourcesThisWeek || 0) - resourcesLastWeek) / resourcesLastWeek * 100)
        : 0

    const ratingGrowth =
      ratingsLastWeek && ratingsLastWeek > 0
        ? Math.round(((ratingsThisWeek || 0) - ratingsLastWeek) / ratingsLastWeek * 100)
        : 0

    const userGrowth =
      usersLastWeek && usersLastWeek > 0
        ? Math.round(((usersThisWeek || 0) - usersLastWeek) / usersLastWeek * 100)
        : 0

    // Get recent activity
    const activities = await getRecentActivity(supabase)

    return NextResponse.json({
      stats: {
        totalResources: totalResources || 0,
        totalRatings: totalRatings || 0,
        totalUsers: totalUsers || 0,
        pendingModeration: pendingModeration || 0,
        resourceGrowth,
        ratingGrowth,
        userGrowth,
      },
      activities,
    })
  } catch (error) {
    console.error('Error fetching admin stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}

async function getRecentActivity(supabase: any): Promise<any[]> {
  try {
    const activities: any[] = []

    // Get recent resources
    const { data: recentResources } = await supabase
      .from('resources')
      .select('id, name, created_at, submitted_by, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(5)

    recentResources?.forEach((resource: any) => {
      activities.push({
        id: `resource-${resource.id}`,
        type: 'resource',
        action: 'submitted a new resource',
        userId: resource.submitted_by,
        userName: resource.profiles?.email?.split('@')[0] || 'User',
        resourceId: resource.id,
        resourceName: resource.name,
        timestamp: resource.created_at,
        metadata: {},
      })
    })

    // Get recent ratings
    const { data: recentRatings } = await supabase
      .from('ratings')
      .select('id, created_at, user_id, resource_id, overall_score, resources(name), profiles(email)')
      .order('created_at', { ascending: false })
      .limit(5)

    recentRatings?.forEach((rating: any) => {
      activities.push({
        id: `rating-${rating.id}`,
        type: 'rating',
        action: `rated ${rating.overall_score}/5`,
        userId: rating.user_id,
        userName: rating.profiles?.email?.split('@')[0] || 'User',
        resourceId: rating.resource_id,
        resourceName: rating.resources?.name,
        timestamp: rating.created_at,
        metadata: { score: rating.overall_score },
      })
    })

    // Get recent moderation actions
    const { data: recentModerations } = await supabase
      .from('moderation_queue')
      .select('id, created_at, submitted_by, item_type, status, profiles(email)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    recentModerations?.forEach((mod: any) => {
      activities.push({
        id: `mod-${mod.id}`,
        type: 'moderation',
        action: `submitted ${mod.item_type} for moderation`,
        userId: mod.submitted_by,
        userName: mod.profiles?.email?.split('@')[0] || 'User',
        timestamp: mod.created_at,
        metadata: { itemType: mod.item_type, status: mod.status },
      })
    })

    // Sort by timestamp (most recent first)
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return activities.slice(0, 10)
  } catch (error) {
    console.error('Error getting recent activity:', error)
    return []
  }
}