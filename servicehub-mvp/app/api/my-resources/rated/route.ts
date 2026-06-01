import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type SortOption = 'date' | 'rating' | 'newest'

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

    // Ensure user can only access their own resources
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch ratings with resource details
    let query = supabase
      .from('ratings')
      .select(
        `
        *,
        resource:resources(*)
      `
      )
      .eq('user_id', userId)

    const { data: ratings, error } = await query

    if (error) {
      console.error('Error fetching rated resources:', error)
      return NextResponse.json({ error: 'Failed to fetch rated resources' }, { status: 500 })
    }

    if (!ratings || ratings.length === 0) {
      return NextResponse.json({ resources: [], categories: [] })
    }

    // Filter by category if provided
    let filtered = ratings
    if (categoryFilter) {
      filtered = ratings.filter((r: any) => r.resource?.category === categoryFilter)
    }

    // Sort resources
    let sorted = filtered
    switch (sort) {
      case 'rating':
        sorted = filtered.sort((a: any, b: any) => b.overall_score - a.overall_score)
        break
      case 'newest':
        sorted = filtered.sort((a: any, b: any) => {
          const dateA = new Date(a.resource?.created_at || 0).getTime()
          const dateB = new Date(b.resource?.created_at || 0).getTime()
          return dateB - dateA
        })
        break
      case 'date':
      default:
        sorted = filtered.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        break
    }

    // Get unique categories
    const categories = [...new Set(ratings.map((r: any) => r.resource?.category).filter(Boolean))] as string[]

    return NextResponse.json({ resources: sorted, categories })
  } catch (error) {
    console.error('Error in rated resources API:', error)
    return NextResponse.json({ error: 'Failed to fetch rated resources' }, { status: 500 })
  }
}