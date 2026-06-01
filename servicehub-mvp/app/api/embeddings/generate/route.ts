import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateBarrierEmbedding,
  generateResourceEmbedding,
  generateResourceDescriptionEmbedding,
} from '@/lib/embeddings/generator'
import {
  upsertUserEmbedding,
  upsertResourceEmbedding,
} from '@/lib/supabase/vector-queries'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getResourceById } from '@/lib/supabase/queries'

/**
 * POST /api/embeddings/generate
 * Generate and store embeddings for users or resources
 * 
 * Body:
 * - type: 'user' | 'resource'
 * - id: user_id or resource_id
 * - force: boolean (optional, regenerate even if exists)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, id, force = false } = body

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required fields: type and id' },
        { status: 400 }
      )
    }

    if (type === 'user') {
      return await generateUserEmbedding(id, user.id, force)
    } else if (type === 'resource') {
      return await generateResourceEmbeddingData(id, user.id, force)
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "user" or "resource"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error generating embeddings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate user embedding from barriers
 */
async function generateUserEmbedding(
  userId: string,
  requestUserId: string,
  force: boolean
) {
  // Users can only generate their own embeddings
  if (userId !== requestUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Check if embedding already exists (unless forcing regeneration)
    if (!force) {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('user_embeddings')
        .select('id')
        .eq('user_id', userId)
        .single()

      if (existing) {
        return NextResponse.json({
          message: 'Embedding already exists',
          userId,
        })
      }
    }

    // Get user barriers
    const barriers = await getUserBarriers(userId)

    // Generate barrier embedding
    const barrierEmbedding = await generateBarrierEmbedding(barriers)

    // Store embedding
    const result = await upsertUserEmbedding(userId, [], barrierEmbedding)

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to store embedding' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'User embedding generated successfully',
      userId,
      barrierEmbeddingGenerated: true,
    })
  } catch (error) {
    console.error('Error generating user embedding:', error)
    return NextResponse.json(
      { error: 'Failed to generate user embedding' },
      { status: 500 }
    )
  }
}

/**
 * Generate resource embedding
 */
async function generateResourceEmbeddingData(
  resourceId: string,
  requestUserId: string,
  force: boolean
) {
  try {
    // Get resource
    const resource = await getResourceById(resourceId)

    if (!resource) {
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      )
    }

    // Check permission (user must be the submitter or admin)
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', requestUserId)
      .single()

    const isAdmin = profile?.role === 'admin'
    const isSubmitter = resource.submitted_by === requestUserId

    if (!isAdmin && !isSubmitter) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if embedding already exists (unless forcing regeneration)
    if (!force) {
      const { data: existing } = await supabase
        .from('resource_embeddings')
        .select('id')
        .eq('resource_id', resourceId)
        .single()

      if (existing) {
        return NextResponse.json({
          message: 'Embedding already exists',
          resourceId,
        })
      }
    }

    // Generate embeddings
    const embedding = await generateResourceEmbedding(resource)
    const descriptionEmbedding = resource.description
      ? await generateResourceDescriptionEmbedding(resource.description)
      : null

    // Store embeddings
    const result = await upsertResourceEmbedding(
      resourceId,
      embedding,
      descriptionEmbedding || undefined
    )

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to store embedding' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Resource embedding generated successfully',
      resourceId,
      embeddingGenerated: true,
      descriptionEmbeddingGenerated: !!descriptionEmbedding,
    })
  } catch (error) {
    console.error('Error generating resource embedding:', error)
    return NextResponse.json(
      { error: 'Failed to generate resource embedding' },
      { status: 500 }
    )
  }
}
