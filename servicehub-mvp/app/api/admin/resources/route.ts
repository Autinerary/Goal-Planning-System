import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResources } from '@/lib/supabase/queries'

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
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const q = searchParams.get('q') || undefined

    // Build filters
    const filters: any = {
      limit: 20,
      offset: (page - 1) * 20,
    }

    if (status && status !== 'all') {
      filters.status = status
    }

    if (category && category !== 'all') {
      filters.category = category
    }

    if (q) {
      filters.search = q
    }

    // Get resources
    const resources = await getResources(filters)

    // Get total count
    let countQuery = supabase.from('resources').select('*', { count: 'exact', head: true })

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status)
    }

    if (category && category !== 'all') {
      countQuery = countQuery.eq('category', category)
    }

    if (q) {
      countQuery = countQuery.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    }

    const { count } = await countQuery

    return NextResponse.json({
      resources,
      total: count || 0,
      page,
      limit: 20,
    })
  } catch (error) {
    console.error('Error fetching admin resources:', error)
    return NextResponse.json({ error: 'Failed to fetch resources' }, { status: 500 })
  }
}