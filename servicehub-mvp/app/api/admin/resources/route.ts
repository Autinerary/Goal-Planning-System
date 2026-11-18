import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResources } from '@/lib/supabase/queries'
import { isAdminUser } from '@/lib/auth/admin'
import { orIlikeValue } from '@/lib/search/words'

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

    if (!(await isAdminUser(supabase, profile?.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Every listing, whoever submitted it: read as the service after the
    // admin check above. With the admin's own session, other people's
    // pending listings never showed (bug audit, 17 November 2026, item 25).
    const admin = createAdminClient()

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || undefined
    const category = searchParams.get('category') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const q = searchParams.get('q')?.trim().slice(0, 200) || undefined

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

    // Get resources (the search box used to be ignored: getResources now filters by it)
    const resources = await getResources(filters, admin)

    // Get total count
    let countQuery = admin.from('resources').select('id', { count: 'exact', head: true })

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status)
    }

    if (category && category !== 'all') {
      countQuery = countQuery.eq('category', category)
    }

    if (q) {
      const like = orIlikeValue(q)
      countQuery = countQuery.or(`name.ilike.${like},description.ilike.${like}`)
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