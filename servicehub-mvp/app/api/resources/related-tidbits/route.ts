import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/resources/related-tidbits?resourceId=&name=
 *
 * Odosa: "Integrate Tidbits AS commentaries in ResourceHub (but as
 * solutions)." community_posts.category_tags/barrier_tags turned out to be
 * free-text a poster types in (see app/community/new/page.tsx's addTag), not
 * the same fixed vocabulary as a resource's category — so there is no clean
 * enum to join on. What both sides genuinely share is text: the resource's
 * name is exactly the kind of thing someone would mention in a post asking
 * "has anyone tried X". Matched with the trigram index already built for
 * ResourceHub search (pg_trgm, STEP 09) rather than adding a new schema.
 *
 * Real matches only — a resource with no real discussion returns an empty
 * list, not a placeholder "no comments yet" dressed up as content.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawName = (searchParams.get('name') || '').trim()
  // PostgREST's .or() takes a comma-separated filter LIST, so a comma or
  // parenthesis in the resource's own name would break the filter syntax —
  // strip anything that is not a normal word character before it goes near
  // the query string. Also skip names too long to plausibly match anyone's
  // free-text post verbatim, and too short to be a meaningful search term.
  const name = rawName.replace(/[,()%*]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!name || name.length < 3 || name.length > 40) return NextResponse.json({ posts: [] })

  const supabase = createClient()
  // ILIKE on a name fragment is what pg_trgm's GIN index actually
  // accelerates; a plain LIKE '%name%' would ignore the index entirely once
  // the table has real volume.
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, title, solved_tldr, accepted_answer_id, score, answer_count, created_at')
    .eq('is_deleted', false)
    .or(`title.ilike.%${name}%,body_markdown.ilike.%${name}%`)
    .order('score', { ascending: false })
    .limit(5)

  if (error) {
    console.error('[related-tidbits]', error.message)
    return NextResponse.json({ posts: [] })
  }

  return NextResponse.json({
    posts: (data || []).map((p) => ({
      id: p.id,
      title: p.title,
      solved: Boolean(p.accepted_answer_id),
      solvedSummary: p.solved_tldr,
      score: p.score,
      answerCount: p.answer_count,
    })),
  })
}
