import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Resource } from '@/types/database'
import { isAdminUser } from '@/lib/auth/admin'
import { queueColumnMissing } from '@/lib/moderation/queue'

const missingTable = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /ratings_all/.test(e.message || ''))

/**
 * POST /api/admin/moderation/[id] { decision: 'approved' | 'rejected', notes? }
 *
 * A moderator's decision on a queue entry. After the admin check, every write
 * is made as the service: with the admin's own session the listing never
 * changed (people may only change their own) and the queue couldn't be
 * written, while the route still reported success (bug audit, 17 November
 * 2026, item 25). Nothing changed is now an error.
 *
 * What the decision does to the item:
 * - a listing becomes approved or rejected;
 * - a rating or product review held by the moderation check shows once
 *   approved (it is no longer waiting); rejected, it is removed.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json().catch(() => ({}))
    const decision = body?.decision
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null

    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Get moderation item
    const { data: item, error: itemError } = await admin
      .from('moderation_queue')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Check if admin decision differs from agent decision
    const agentDecision = (item as any).agent_decision
    const adminOverrides = decision === 'approved' && agentDecision === 'reject'

    // Update moderation queue (review_notes and admin_override arrive with
    // STEP 105; before it the notes go in `reason`).
    const reviewed = { status: decision, reviewed_by: user.id, reviewed_at: new Date().toISOString() }
    let { data: updated, error: updateError } = await admin
      .from('moderation_queue')
      .update({ ...reviewed, review_notes: notes, admin_override: adminOverrides })
      .eq('id', params.id)
      .select('id')
    if (updateError && queueColumnMissing(updateError)) {
      ;({ data: updated, error: updateError } = await admin
        .from('moderation_queue')
        .update({ ...reviewed, ...(notes ? { reason: notes } : {}) })
        .eq('id', params.id)
        .select('id'))
    }

    if (updateError) {
      throw updateError
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'That entry was not found, so nothing changed.' }, { status: 404 })
    }

    // Update the actual item
    if (item.item_type === 'rating' || item.item_type === 'product_review') {
      if (decision === 'rejected') {
        // Removed: it was never shown, and a rejected one doesn't stay.
        let removed: { id: string }[] | null = null
        let removeError: { code?: string; message?: string } | null = null
        if (item.item_type === 'rating') {
          ;({ data: removed, error: removeError } = await admin.from('ratings_all').delete().eq('id', item.item_id).select('id'))
          if (missingTable(removeError)) ({ data: removed, error: removeError } = await admin.from('ratings').delete().eq('id', item.item_id).select('id'))
        } else {
          ;({ data: removed, error: removeError } = await admin.from('product_reviews').delete().eq('id', item.item_id).select('id'))
        }
        if (removeError) throw removeError
        if (!removed || removed.length === 0) {
          // Already gone (its author removed it): the decision still stands.
          console.warn(`[admin/moderation] ${item.item_type} ${item.item_id} was already removed`)
        }
      }
      // Approved: it is no longer waiting, so it shows.
    } else if (item.item_type === 'resource') {
      const resourceStatus = decision === 'approved' ? 'approved' : 'rejected'
      const { data: changed, error: resourceError } = await admin
        .from('resources')
        .update({ status: resourceStatus })
        .eq('id', item.item_id)
        .select('*')
      if (resourceError) throw resourceError
      const resource = (changed || [])[0] as Resource | undefined
      if (!resource) {
        return NextResponse.json({ error: 'The entry is closed, but its listing no longer exists.' }, { status: 404 })
      }

      // Generate embedding when a moderation review flips a resource to approved, so it
      // shows up in semantic search. Awaited but error-tolerant — approval succeeds even
      // if embedding generation fails (batch backfill can recover).
      if (decision === 'approved') {
        try {
          await onResourceCreated(resource)
        } catch (embeddingError) {
          console.error(
            `Embedding generation failed for resource ${item.item_id}:`,
            embeddingError
          )
        }
      }
    }

    return NextResponse.json({ success: true, overrides: adminOverrides })
  } catch (error) {
    console.error('Error reviewing moderation item:', error)
    return NextResponse.json({ error: 'Failed to review item' }, { status: 500 })
  }
}
