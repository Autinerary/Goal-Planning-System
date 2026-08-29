import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
 * recorded when the review is made.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Sign in to review a product' }, { status: 401 })
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
  const comment = (body.comment || '').trim().slice(0, 2000) || null

  // Per-norm scores, same shape as ratings.barrier_scores.
  const barrier_scores: Record<string, number> = {}
  for (const [k, v] of Object.entries(body.barrier_scores || {})) {
    const n = Number(v)
    if (k && Number.isFinite(n) && n >= 1 && n <= 5) barrier_scores[k] = Math.round(n)
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

  // One review per (product, user): upsert on that pair so re-rating edits
  // rather than duplicating. onConflict is named explicitly — defaulting to the
  // primary key would insert a second row instead of updating.
  const { data, error } = await supabase
    .from('product_reviews')
    .upsert(
      {
        product_id: params.id,
        user_id: user.id,
        rating,
        comment,
        barrier_scores,
        rater_diagnostics,
        rater_relationships,
        rater_org_ids,
      },
      { onConflict: 'product_id,user_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[shop] review write failed:', error.message)
    return NextResponse.json({ error: 'Could not save your review' }, { status: 500 })
  }

  return NextResponse.json({ review: data }, { status: 201 })
}
