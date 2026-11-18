import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdminUser } from '@/lib/auth/admin'

const STATUSES = ['pending', 'approved', 'rejected'] as const

/**
 * GET /api/admin/moderation?status=pending|approved|rejected|all — the
 * moderation queue, for admins. Read as the service after the admin check.
 *
 * What each entry is about comes with it: a listing, a rating or a product
 * review, with the fields the dashboard shows only (a rating's score and
 * words, never the rater's private details; bug audit, 17 November 2026,
 * item 2), and who sent it.
 */
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

    const admin = createAdminClient()
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'

    // Build query
    let query = admin.from('moderation_queue').select('*')

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: items, error } = await query.order('created_at', { ascending: false }).limit(100)

    if (error) {
      throw error
    }

    const list = (items || []) as Record<string, any>[]
    const idsOf = (type: string) => list.filter((i) => i.item_type === type).map((i) => String(i.item_id))

    // What each entry is about, in one read per kind. Ratings come from
    // ratings_all, so a test account's flagged rating is shown to moderators too.
    const readRatings = async (ids: string[]) => {
      if (ids.length === 0) return [] as any[]
      const cols = 'id, resource_id, user_id, overall_score, barrier_scores, comment, created_at'
      let { data, error: e } = await admin.from('ratings_all').select(cols).in('id', ids)
      if (e) ({ data, error: e } = await admin.from('ratings').select(cols).in('id', ids))
      if (e) console.error('[admin/moderation] ratings not read:', e.message)
      return data || []
    }
    const [ratings, resources, reviews] = await Promise.all([
      readRatings(idsOf('rating')),
      idsOf('resource').length
        ? admin.from('resources').select('*').in('id', idsOf('resource')).then((r) => r.data || [])
        : Promise.resolve([] as any[]),
      idsOf('product_review').length
        ? admin.from('product_reviews').select('id, product_id, user_id, rating, comment, created_at').in('id', idsOf('product_review')).then((r) => r.data || [])
        : Promise.resolve([] as any[]),
    ])
    const byId = new Map<string, { data: Record<string, any>; owner: string | null }>()
    for (const r of ratings as any[]) {
      const { user_id, ...shown } = r
      byId.set(`rating:${r.id}`, { data: shown, owner: user_id ?? null })
    }
    for (const r of resources as any[]) byId.set(`resource:${r.id}`, { data: r, owner: r.submitted_by ?? null })
    for (const r of reviews as any[]) {
      // Shown like a rating: its words and its score.
      byId.set(`product_review:${r.id}`, {
        data: { id: r.id, product_id: r.product_id, comment: r.comment, overall_score: r.rating, created_at: r.created_at },
        owner: r.user_id ?? null,
      })
    }

    // Who sent each one: submitted_by since STEP 105, otherwise the item's own author.
    const ownerOf = (item: Record<string, any>) => item.submitted_by || byId.get(`${item.item_type}:${item.item_id}`)?.owner || null
    const userIds = [...new Set(list.map(ownerOf).filter(Boolean))] as string[]
    const { data: profiles } = userIds.length
      ? await admin.from('profiles').select('id, email').in('id', userIds)
      : { data: [] as { id: string; email: string | null }[] }

    const emailMap = new Map((profiles || []).map((p: { id: string; email: string | null }) => [p.id, p.email]))

    const enrichedItems = list.map((item) => {
      const owner = ownerOf(item)
      return {
        ...item,
        submitted_by: item.submitted_by ?? owner,
        user_email: (owner && emailMap.get(owner)) || owner,
        item_data: byId.get(`${item.item_type}:${item.item_id}`)?.data ?? null,
      }
    })

    // Counts by status, counted by the database (no row limit).
    const counted = await Promise.all(
      STATUSES.map((s) => admin.from('moderation_queue').select('id', { count: 'exact', head: true }).eq('status', s))
    )
    const total = await admin.from('moderation_queue').select('id', { count: 'exact', head: true })
    const stats = {
      pending: counted[0].count || 0,
      approved: counted[1].count || 0,
      rejected: counted[2].count || 0,
      total: total.count || 0,
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
