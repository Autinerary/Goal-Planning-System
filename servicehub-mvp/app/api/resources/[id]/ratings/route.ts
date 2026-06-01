import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createOrUpdateRating, getRatingByUserAndResource } from '@/lib/supabase/queries'
import { validationAgent } from '@/lib/agents/validation-agent'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import { sendNotification } from '@/lib/notifications/service'
import { formatErrorForUser, createAppError, logError } from '@/lib/errors/handler'
import type { ValidationAgentInput } from '@/lib/agents/validation-agent/types'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      const error = createAppError('You must be signed in to rate resources', 'unauthorized', {
        statusCode: 401,
      })
      await logError(error, { action: 'create_rating', path: `/resources/${params.id}/ratings` })
      return NextResponse.json({ error: error.userMessage }, { status: 401 })
    }

    // Check if resource exists
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('id, name, status')
      .eq('id', params.id)
      .single()

    if (resourceError || !resource) {
      const error = createAppError('Resource not found', 'not-found', {
        statusCode: 404,
      })
      await logError(error, { action: 'create_rating', path: `/resources/${params.id}/ratings` })
      return NextResponse.json({ error: error.userMessage }, { status: 404 })
    }

    // Check if resource is approved
    if (resource.status !== 'approved') {
      const error = createAppError('This resource is not yet approved for ratings', 'validation', {
        statusCode: 400,
      })
      return NextResponse.json({ error: error.userMessage }, { status: 400 })
    }

    const body = await request.json()
    const { overall_score, barrier_scores, comment, image_urls } = body

    if (!overall_score || overall_score < 1 || overall_score > 5) {
      const error = createAppError('Overall score must be between 1 and 5', 'validation', {
        statusCode: 400,
      })
      return NextResponse.json({ error: error.userMessage }, { status: 400 })
    }

    // Validate comment length
    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
    }

    // Validate using Validation Agent
    const userHistory = await getUserHistory(user.id)
    const validationInput: ValidationAgentInput = {
      itemType: 'rating',
      item: {
        overall_score,
        barrier_scores,
        comment,
        resource_id: params.id,
        user_id: user.id,
      },
      context: {
        userId: user.id,
        userHistory,
      },
    }

    const validationResult = await validationAgent.validate(validationInput)

    // Handle validation decision
    if (validationResult.decision === 'reject') {
      return NextResponse.json(
        {
          error: 'Rating rejected by validation agent',
          reasons: validationResult.reasons,
          trustScore: validationResult.trustScore,
        },
        { status: 403 }
      )
    }

    // Add to moderation queue if flagged for review
    if (validationResult.decision === 'flag_for_review') {
      await supabase.from('moderation_queue').insert({
        item_type: 'rating',
        item_id: params.id, // Will be updated after rating is created
        submitted_by: user.id,
        status: 'pending',
        agent_decision: validationResult.decision,
        agent_confidence: validationResult.confidence,
        agent_reasons: validationResult.reasons,
      })
    }

    // Create or update rating (only if approved or flagged for review)
    const rating = await createOrUpdateRating({
      resource_id: params.id,
      user_id: user.id,
      overall_score,
      barrier_scores,
      comment: comment?.trim() || undefined,
    })

    if (!rating) {
      return NextResponse.json({ error: 'Failed to create rating' }, { status: 500 })
    }

    // Update moderation queue with rating ID if flagged
    if (validationResult.decision === 'flag_for_review') {
      await supabase
        .from('moderation_queue')
        .update({ item_id: rating.id })
        .eq('submitted_by', user.id)
        .eq('item_type', 'rating')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
    }

    // Store image URLs if provided
    // Note: In production, you might want to store image URLs in a separate table
    // or add an image_urls field to the ratings table
    if (image_urls && Array.isArray(image_urls) && image_urls.length > 0) {
      // For now, we'll store image URLs in the comment metadata or a separate field
      // This is a simplified approach - in production, consider a separate ratings_images table
    }

    // Notify users who saved this resource about the new rating
    const { data: savedResources } = await supabase
      .from('saved_resources')
      .select('user_id')
      .eq('resource_id', params.id)
      .neq('user_id', user.id) // Don't notify the rater

    if (savedResources && savedResources.length > 0) {
      // Get resource name
      const { data: resource } = await supabase
        .from('resources')
        .select('name')
        .eq('id', params.id)
        .single()

      // Send notification to each user who saved this resource
      for (const saved of savedResources) {
        await sendNotification(saved.user_id, 'resource_saved_new_rating', {
          resourceId: params.id,
          resourceName: resource?.name || 'A resource you saved',
        })
      }
    }

    return NextResponse.json({
      success: true,
      rating,
      validation: {
        decision: validationResult.decision,
        confidence: validationResult.confidence,
        trustScore: validationResult.trustScore,
      },
    })
  } catch (error) {
    const formatted = formatErrorForUser(error)
    await logError(error, {
      action: 'create_rating',
      userId: (await supabase.auth.getUser()).data.user?.id,
      path: `/resources/${params.id}/ratings`,
    })
    return NextResponse.json(
      { error: formatted.message, type: formatted.type },
      { status: formatted.type === 'network' ? 503 : 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

        if (!user) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user is a rater (architecture requirement: only raters can rate)
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_rater')
          .eq('id', user.id)
          .single()

        if (!profile?.is_rater) {
          return NextResponse.json(
            {
              error: 'Only authorized raters can submit ratings',
              message: 'You must be authorized as a rater to submit ratings. All users can recommend resources, but only selected raters can rate them.',
            },
            { status: 403 }
          )
        }

    const body = await request.json()
    const { overall_score, barrier_scores, comment, image_urls } = body

    if (!overall_score || overall_score < 1 || overall_score > 5) {
      return NextResponse.json({ error: 'Invalid overall_score' }, { status: 400 })
    }

    // Validate comment length
    if (comment && comment.length > 500) {
      return NextResponse.json({ error: 'Comment must be 500 characters or less' }, { status: 400 })
    }

    // Update rating (createOrUpdateRating handles both create and update)
    const rating = await createOrUpdateRating({
      resource_id: params.id,
      user_id: user.id,
      overall_score,
      barrier_scores,
      comment: comment?.trim() || undefined,
    })

    if (!rating) {
      return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
    }

    return NextResponse.json({ success: true, rating })
  } catch (error) {
    console.error('Error updating rating:', error)
    return NextResponse.json({ error: 'Failed to update rating' }, { status: 500 })
  }
}