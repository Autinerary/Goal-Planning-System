import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendNotification } from '@/lib/notifications/service'
import { onResourceCreated } from '@/lib/embeddings/auto-generate'
import type { Resource } from '@/types/database'

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

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action } = await request.json()
    const resourceId = params.id

    if (action === 'approve') {
      // Get full resource (need all fields for embedding generation)
      const { data: resource } = await supabase
        .from('resources')
        .select('*')
        .eq('id', resourceId)
        .single()

      // Update resource status
      const { error } = await supabase
        .from('resources')
        .update({ status: 'approved' })
        .eq('id', resourceId)

      if (error) throw error

      // Update moderation queue
      await supabase
        .from('moderation_queue')
        .update({ status: 'approved', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('item_id', resourceId)
        .eq('item_type', 'resource')

      // Generate embedding now that resource is live (so it shows up in semantic search).
      // Awaited so it actually runs to completion on Vercel serverless — admin actions are
      // infrequent enough that the extra latency is acceptable. Failure is logged but does
      // not roll back the approval; the batch backfill can pick it up later.
      if (resource) {
        try {
          await onResourceCreated(resource as Resource)
        } catch (embeddingError) {
          console.error(`Embedding generation failed for resource ${resourceId}:`, embeddingError)
        }
      }

      // Send notification to submitter
      if (resource?.submitted_by) {
        await sendNotification(resource.submitted_by, 'resource_approved', {
          resourceId,
          resourceName: resource.name,
        })
      }

      return NextResponse.json({ success: true })
    } else if (action === 'reject') {
      // Get resource details
      const { data: resource } = await supabase
        .from('resources')
        .select('name, submitted_by')
        .eq('id', resourceId)
        .single()

      // Update resource status
      const { error } = await supabase
        .from('resources')
        .update({ status: 'rejected' })
        .eq('id', resourceId)

      if (error) throw error

      // Update moderation queue
      await supabase
        .from('moderation_queue')
        .update({ status: 'rejected', reviewed_by: user.id, reviewed_at: new Date().toISOString() })
        .eq('item_id', resourceId)
        .eq('item_type', 'resource')

      // Send notification to submitter
      if (resource?.submitted_by) {
        await sendNotification(resource.submitted_by, 'resource_rejected', {
          resourceId,
          resourceName: resource.name,
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
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

    const resourceId = params.id

    // Soft delete: set status to 'deleted' instead of actually deleting
    const { error } = await supabase
      .from('resources')
      .update({ status: 'deleted' })
      .eq('id', resourceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return NextResponse.json({ error: 'Failed to delete resource' }, { status: 500 })
  }
}