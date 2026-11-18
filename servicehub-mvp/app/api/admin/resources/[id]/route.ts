import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotification } from '@/lib/notifications/service'
import { onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Resource } from '@/types/database'
import { isAdminUser } from '@/lib/auth/admin'

/**
 * The signed-in person, when they are an admin; otherwise the response to
 * send. Admin pages check this first; the writes below then use the admin
 * client, because a listing's status is the server's to set (people may only
 * change their own listings, and since STEP 105 never their status). With the
 * person's session, approve, reject and delete changed nothing and still
 * reported success (bug audit, 17 November 2026, items 4 and 25).
 */
async function adminOnly(): Promise<{ userId: string } | NextResponse> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!(await isAdminUser(supabase, profile?.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { userId: user.id }
}

/** Close the listing's pending moderation entries with the decision (logged on failure; the listing is what counts). */
async function closeQueueEntries(admin: ReturnType<typeof createAdminClient>, resourceId: string, status: 'approved' | 'rejected', reviewerId: string) {
  const { error } = await admin
    .from('moderation_queue')
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
    .eq('item_id', resourceId)
    .eq('item_type', 'resource')
    .eq('status', 'pending')
  if (error) console.error('[admin/resources] moderation queue not updated:', error.message)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const allowed = await adminOnly()
    if (allowed instanceof NextResponse) return allowed

    const { action } = await request.json().catch(() => ({ action: null }))
    const resourceId = params.id
    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const admin = createAdminClient()
    const status = action === 'approve' ? 'approved' : 'rejected'

    // The whole row comes back: approval needs it for the embedding.
    const { data: changed, error } = await admin
      .from('resources')
      .update({ status })
      .eq('id', resourceId)
      .select('*')

    if (error) throw error
    const resource = (changed || [])[0] as Resource | undefined
    if (!resource) {
      return NextResponse.json({ error: 'That listing was not found, so nothing changed.' }, { status: 404 })
    }

    await closeQueueEntries(admin, resourceId, status, allowed.userId)

    if (status === 'approved') {
      // Generate embedding now that resource is live (so it shows up in semantic search).
      // Awaited so it actually runs to completion on Vercel serverless — admin actions are
      // infrequent enough that the extra latency is acceptable. Failure is logged but does
      // not roll back the approval; the batch backfill can pick it up later.
      try {
        await onResourceCreated(resource)
      } catch (embeddingError) {
        console.error(`Embedding generation failed for resource ${resourceId}:`, embeddingError)
      }
    }

    // Send notification to submitter
    if (resource.submitted_by) {
      await sendNotification(resource.submitted_by, status === 'approved' ? 'resource_approved' : 'resource_rejected', {
        resourceId,
        resourceName: resource.name,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating resource:', error)
    return NextResponse.json({ error: 'Failed to update resource' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const allowed = await adminOnly()
    if (allowed instanceof NextResponse) return allowed

    const resourceId = params.id

    // Soft delete: set status to 'deleted' instead of actually deleting
    const { data: changed, error } = await createAdminClient()
      .from('resources')
      .update({ status: 'deleted' })
      .eq('id', resourceId)
      .select('id')

    if (error) throw error
    if (!changed || changed.length === 0) {
      return NextResponse.json({ error: 'That listing was not found, so nothing changed.' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 })
  }
}
