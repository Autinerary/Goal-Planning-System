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

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId') || user.id
    const statusFilter = searchParams.get('status')

    // Ensure user can only access their own resources
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch submitted resources
    let query = supabase.from('resources').select('*').eq('submitted_by', userId).order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: resources, error } = await query

    if (error) {
      console.error('Error fetching submitted resources:', error)
      return NextResponse.json({ error: 'Failed to fetch submitted resources' }, { status: 500 })
    }

    return NextResponse.json({ resources: resources || [] })
  } catch (error) {
    console.error('Error in submitted resources API:', error)
    return NextResponse.json({ error: 'Failed to fetch submitted resources' }, { status: 500 })
  }
}