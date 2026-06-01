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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const role = searchParams.get('role') || undefined
    const sort = searchParams.get('sort') || 'newest'
    const page = parseInt(searchParams.get('page') || '1')
    const q = searchParams.get('q') || undefined

    // Build query
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' })

    // Apply filters
    if (role && role !== 'all') {
      query = query.eq('role', role)
    }

    if (q) {
      query = query.or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
    }

    // Apply sorting
    switch (sort) {
      case 'newest':
        query = query.order('created_at', { ascending: false })
        break
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'most_active':
        // Would need to join with ratings/resources counts
        query = query.order('created_at', { ascending: false })
        break
      case 'least_active':
        query = query.order('created_at', { ascending: true })
        break
      default:
        query = query.order('created_at', { ascending: false })
    }

    // Apply pagination
    query = query.range((page - 1) * 20, page * 20 - 1)

    const { data: users, count } = await query

    // Get activity counts for each user
    const usersWithActivity = await Promise.all(
      (users || []).map(async (userProfile) => {
        const { count: ratingsCount } = await supabase
          .from('ratings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userProfile.id)

        const { count: resourcesCount } = await supabase
          .from('resources')
          .select('*', { count: 'exact', head: true })
          .eq('submitted_by', userProfile.id)

        return {
          ...userProfile,
          ratingsCount: ratingsCount || 0,
          resourcesCount: resourcesCount || 0,
        }
      })
    )

    return NextResponse.json({
      users: usersWithActivity,
      total: count || 0,
      page,
      limit: 20,
    })
  } catch (error) {
    console.error('Error fetching admin users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}