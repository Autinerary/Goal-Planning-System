import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { moderateText, reviewFlag } from '@/lib/community/moderation'
import { detectSpam } from '@/lib/agents/validation-agent/spam-detector'
import { CANT_POST_MESSAGE, isPostingBlockedError, postingBlockedReason } from '@/lib/community/client'
import { enqueueModeration } from '@/lib/moderation/queue'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What goes back to the browser: never the whole row, whose rater_* snapshot
// is private (bug audit, 17 November 2026, item 2).
const REVIEW_COLUMNS = 'id, product_id, rating, comment, barrier_scores, created_at'

/**
 * POST /api/shop/products/[id]/reviews — rate a product.
 *
 * This route did not exist. product_reviews was readable but had no write path
 * anywhere in the app, which is why rating a product was impossible (Odosa:
 * "currently unable to rate a product").
 *
 * Mirrors the service ratings route: the reviewer's own diagnostics,
 * per-norm relationships and organisations are snapshotted at write time.
 * That snapshot is what makes the breakdown possible at all — RLS blocks
 * reading another user's profile at render time, so the facts have to be
 * recorded when the review is made. Since STEP 105 the database moves the
 * snapshot to a table only the service reads (lib/ratings/raterContext.ts).
 *
 * The words get the same checks as comments on a service (bug audit,
 * 17 November 2026, item 16): a slur is refused, swearing is bleeped, spam is
 * refused, and a review the automatic check flags waits for a moderator
 * before it shows. Only live products can be reviewed, and not by an account
 * that is banned or paused from posting.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'Which product?' }, { status: 400 })
  }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to review a product' }, { status: 401 })
  }

  const blocked = await postingBlockedReason(user.id)
  if (blocked) {
    return NextResponse.json({ error: blocked, code: 'blocked' }, { status: 403 })
  }

  let body: { rating?: number; comment?: string; barrier_scores?: Record<string, number> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const rating = Number(body.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be a whole number from 1 to 5' }, { status: 400 })
  }

  // Only a product that is in the Shop now.
  const { data: product } = await supabase.from('products').select('id, status').eq('id', params.id).maybeSingle()
  if (!product || (product as { status?: string }).status !== 'active') {
    return NextResponse.json({ error: "This product isn't in the Shop right now, so it can't be reviewed." }, { status: 404 })
  }

  // The words: the same rules as comments on a service.
  let comment: string | null = (typeof body.comment === 'string' ? body.comment : '').trim().slice(0, 2000) || null
  let flag: Awaited<ReturnType<typeof reviewFlag>> = { flag: null, reason: null, selfHarm: false }
  if (comment) {
    const moderated = moderateText(comment)
    if (moderated.slur) {
      return NextResponse.json({ error: 'That review uses words we do not allow. Please change it.' }, { status: 400 })
    }
    if (detectSpam(moderated.text).isSpam) {
      return NextResponse.json({ error: 'That review looks like spam. Please change it.' }, { status: 400 })
    }
    comment = moderated.text
    flag = await reviewFlag(comment)
  }

  // Per-norm scores, same shape as ratings.barrier_scores.
  const barrier_scores: Record<string, number> = {}
  for (const [k, v] of Object.entries(body.barrier_scores && typeof body.barrier_scores === 'object' ? body.barrier_scores : {}).slice(0, 30)) {
    const n = Number(v)
    if (k && k.length <= 60 && Number.isFinite(n) && n >= 1 && n <= 5) barrier_scores[k] = Math.round(n)
  }

  // Snapshot the reviewer's OWN diagnostics and per-norm relationships.
  const rater_diagnostics: Record<string, number> = {}
  const rater_relationships: Record<string, string> = {}
  try {
    const { data: myBarriers } = await supabase
      .from('user_barriers')
      .select('barrier_type, severity, relationship, relationship_declared')
      .eq('user_id', user.id)
    for (const b of myBarriers || []) {
      const type = String((b as any).barrier_type || '').trim().toLowerCase()
      if (!type) continue
      const sev = Number((b as any).severity)
      rater_diagnostics[type] = sev >= 1 && sev <= 5 ? Math.round(sev) : 3
      // Only declared relationships are recorded — an undeclared reviewer is
      // weighted as lived (safe) but never badged as such.
      if ((b as any).relationship_declared) {
        rater_relationships[type] = String((b as any).relationship || 'lived')
      }
    }
  } catch {
    /* non-fatal — the review still saves without the breakdown data */
  }

  let rater_org_ids: string[] = []
  try {
    const { data: myOrgs } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
    rater_org_ids = (myOrgs || []).map((o: any) => String(o.org_id || '')).filter(Boolean)
  } catch {
    /* non-fatal — the review still saves without org grouping */
  }

  // One review per (product, user): re-rating edits it rather than adding another.
  const { data: existing } = await supabase
    .from('product_reviews')
    .select('id')
    .eq('product_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()
  const reviewId: string = (existing as { id: string } | null)?.id ?? randomUUID()

  // A flagged review is put in the moderation queue before it is saved, so
  // it never shows unreviewed; if the queue can't be written, nothing is saved.
  const pendingReview = flag.flag === 'review'
  if (pendingReview) {
    const queued = await enqueueModeration({
      item_type: 'product_review',
      item_id: reviewId,
      submitted_by: user.id,
      agent_decision: 'flag_for_review',
      agent_reasons: flag.reason ? [flag.reason] : null,
      reason: flag.reason,
    })
    if (!queued) {
      return NextResponse.json({ error: "We couldn't save your review just now. Please try again in a minute." }, { status: 503 })
    }
  }

  const fields = {
    rating,
    comment,
    barrier_scores,
    rater_diagnostics,
    rater_relationships,
    rater_org_ids,
  }
  const write = (asNew: boolean) =>
    asNew
      ? supabase.from('product_reviews').insert({ id: reviewId, product_id: params.id, user_id: user.id, ...fields }).select(REVIEW_COLUMNS).single()
      : supabase.from('product_reviews').update(fields).eq('id', reviewId).eq('user_id', user.id).select(REVIEW_COLUMNS).single()
  let { data, error } = await write(!existing)
  // Saved from another tab a moment ago: change that one instead.
  if (error?.code === '23505' && !existing) {
    const { data: again } = await supabase.from('product_reviews').select('id').eq('product_id', params.id).eq('user_id', user.id).maybeSingle()
    if (again) ({ data, error } = await supabase.from('product_reviews').update(fields).eq('id', (again as { id: string }).id).eq('user_id', user.id).select(REVIEW_COLUMNS).single())
  }

  if (error) {
    if (isPostingBlockedError(error)) {
      return NextResponse.json({ error: CANT_POST_MESSAGE, code: 'blocked' }, { status: 403 })
    }
    console.error('[shop] review write failed:', error.message)
    return NextResponse.json({ error: 'Could not save your review' }, { status: 500 })
  }

  return NextResponse.json({ review: data, pending_review: pendingReview }, { status: 201 })
}
