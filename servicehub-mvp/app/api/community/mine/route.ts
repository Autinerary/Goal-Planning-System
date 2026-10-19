/**
 * GET /api/community/mine?tab=published|drafts|well-dones — "My Tidbits"
 * (the Tidbits round's planning note, Goal 4): your published posts, your
 * drafts, and your Previous Well-Dones (the Tidbits you rated, "similar to
 * Liked/Bookmarked on Twitter").
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCommunityServiceClient, getCommunityViewer } from '@/lib/community/client'
import { loadAuthorMap } from '@/lib/community/hydrate'
import { step83Missing } from '@/lib/community/tidbits'
import { loadGroups, summarize } from '@/lib/community/tidbitsServer'

export const dynamic = 'force-dynamic'

const COLUMNS =
  'id, author_id, title, body_markdown, unlocking_moment, what_didnt_work, author_relationships, barrier_tags, category_tags, image_urls, upvotes, downvotes, score, answer_count, view_count, accepted_answer_id, solved_tldr, solved_key_insight, is_locked, last_activity_at, created_at, content_note, kind, length_type, status, is_anonymous, group_id, source, external_url, external_platform, external_platform_url, byline, word_count, published_at, bite_count, well_done_count, well_done_sum, item_count, updated_at'

export async function GET(request: NextRequest) {
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ posts: [] }, { status: 503 })
  const viewer = await getCommunityViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const tab = new URL(request.url).searchParams.get('tab') || 'published'

  let rows: any[] = []
  let ratings = new Map<string, number>()
  if (tab === 'well-dones') {
    const { data: rated, error } = await client
      .from('community_post_ratings')
      .select('post_id, rating, updated_at')
      .eq('user_id', viewer.user_id)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ posts: [], open: !step83Missing(error) })
    ratings = new Map(((rated as any[]) ?? []).map((r) => [r.post_id, r.rating]))
    if (ratings.size) {
      const { data } = await client.from('community_posts').select(COLUMNS).in('id', Array.from(ratings.keys())).eq('is_deleted', false).eq('status', 'published')
      const order = Array.from(ratings.keys())
      rows = ((data as any[]) ?? []).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    }
  } else {
    const { data, error } = await client
      .from('community_posts')
      .select(COLUMNS)
      .eq('author_id', viewer.user_id)
      .eq('is_deleted', false)
      .eq('status', tab === 'drafts' ? 'draft' : 'published')
      .order('updated_at', { ascending: false })
      .limit(100)
    if (error) return NextResponse.json({ posts: [], open: !step83Missing(error) })
    rows = (data as any[]) ?? []
  }
  const [authors, groups] = await Promise.all([loadAuthorMap(client, rows.map((r) => r.author_id)), loadGroups(client)])
  return NextResponse.json({
    open: true,
    tab,
    posts: rows.map((r) => ({
      ...summarize(r, authors.get(r.author_id), viewer, 0, r.group_id ? groups.byId.get(r.group_id) ?? null : null),
      updated_at: r.updated_at,
      ...(ratings.has(r.id) ? { viewer_well_done: ratings.get(r.id) } : {}),
    })),
  })
}
